import { Router, type IRouter } from "express";
import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import {
  CreatePostBody,
  DeletePostParams,
  GetUserProfileParams,
  ImportLegacyPostsBody,
  LikePostParams,
  ListFeedQueryParams,
  SearchUsersQueryParams,
  UnlikePostParams,
} from "@workspace/api-zod";
import type {
  ErrorResponse,
  FeedResponse,
  LikeResponse,
  PostCreationResult,
  PostImportResponse,
  ProfileResponse,
  PublicProfile,
  SocialPost,
  UserSearchResults,
} from "@workspace/api-zod";
import { db, postLikesTable, postsTable, usersTable } from "@workspace/db";
import { getAuthContext, requireAuth } from "../lib/auth";
import { refreshCreatorsAfterActivity } from "../lib/creator-program";

const router: IRouter = Router();
const MAX_POSTS = 50;
const MAX_PROFILE_POSTS = 50;
const MAX_SEARCH_RESULTS = 20;

type PostRow = {
  id: string;
  sourceId: string | null;
  text: string;
  createdAt: Date;
  authorId: string;
  username: string;
  displayName: string;
  joinedAt: Date;
};

function publicProfile(user: {
  id: string;
  username: string;
  displayName: string;
  createdAt: Date;
}): PublicProfile {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    joinedAt: user.createdAt.getTime(),
  };
}

async function listPostRows(limit: number, authorId?: string): Promise<PostRow[]> {
  const query = db
    .select({
      id: postsTable.id,
      sourceId: postsTable.sourceId,
      text: postsTable.text,
      createdAt: postsTable.createdAt,
      authorId: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      joinedAt: usersTable.createdAt,
    })
    .from(postsTable)
    .innerJoin(usersTable, eq(postsTable.authorId, usersTable.id));

  if (authorId) {
    return query
      .where(eq(postsTable.authorId, authorId))
      .orderBy(desc(postsTable.createdAt), desc(postsTable.id))
      .limit(limit);
  }

  return query.orderBy(desc(postsTable.createdAt), desc(postsTable.id)).limit(limit);
}

async function postsForViewer(rows: PostRow[], viewerId: string): Promise<SocialPost[]> {
  if (rows.length === 0) {
    return [];
  }

  const postIds = rows.map((row) => row.id);
  const [likeCounts, viewerLikes] = await Promise.all([
    db
      .select({
        postId: postLikesTable.postId,
        likeCount: sql<number>`count(*)::int`,
      })
      .from(postLikesTable)
      .where(inArray(postLikesTable.postId, postIds))
      .groupBy(postLikesTable.postId),
    db
      .select({ postId: postLikesTable.postId })
      .from(postLikesTable)
      .where(
        and(
          eq(postLikesTable.userId, viewerId),
          inArray(postLikesTable.postId, postIds),
        ),
      ),
  ]);

  const counts = new Map(likeCounts.map((item) => [item.postId, Number(item.likeCount)]));
  const liked = new Set(viewerLikes.map((item) => item.postId));

  return rows.map((row) => ({
    id: row.id,
    sourceId: row.sourceId,
    text: row.text,
    createdAt: row.createdAt.getTime(),
    author: {
      id: row.authorId,
      username: row.username,
      displayName: row.displayName,
      joinedAt: row.joinedAt.getTime(),
    },
    likeCount: counts.get(row.id) ?? 0,
    likedByMe: liked.has(row.id),
  }));
}

async function getPostRow(postId: string): Promise<PostRow | undefined> {
  const [row] = await db
    .select({
      id: postsTable.id,
      sourceId: postsTable.sourceId,
      text: postsTable.text,
      createdAt: postsTable.createdAt,
      authorId: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      joinedAt: usersTable.createdAt,
    })
    .from(postsTable)
    .innerJoin(usersTable, eq(postsTable.authorId, usersTable.id))
    .where(eq(postsTable.id, postId))
    .limit(1);
  return row;
}

async function currentLikeCount(postId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postLikesTable)
    .where(eq(postLikesTable.postId, postId));
  return Number(result?.count ?? 0);
}

router.get("/feed", requireAuth, async (req, res): Promise<void> => {
  const params = ListFeedQueryParams.safeParse(req.query);
  if (!params.success) {
    const response: ErrorResponse = { error: "The feed request is invalid." };
    res.status(400).json(response);
    return;
  }

  const { userId } = getAuthContext(res);
  const limit = Math.min(params.data.limit ?? 30, MAX_POSTS);
  const rows = await listPostRows(limit);
  const response: FeedResponse = { posts: await postsForViewer(rows, userId) };
  res.json(response);
});

router.post("/posts", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreatePostBody.safeParse(req.body);
  if (!parsed.success) {
    const response: ErrorResponse = { error: "Posts must be between 1 and 1,000 characters." };
    res.status(400).json(response);
    return;
  }

  const text = parsed.data.text.trim();
  if (!text || text.length > 1000) {
    const response: ErrorResponse = { error: "Posts must be between 1 and 1,000 characters." };
    res.status(400).json(response);
    return;
  }

  const { userId } = getAuthContext(res);
  const [created] = await db
    .insert(postsTable)
    .values({ authorId: userId, text })
    .returning({ id: postsTable.id });
  const row = await getPostRow(created.id);
  if (!row) {
    throw new Error("Created post could not be loaded.");
  }

  const [post] = await postsForViewer([row], userId);
  const response: PostCreationResult = { post };
  res.status(201).json(response);
  refreshCreatorsAfterActivity([userId]);
});

router.post("/posts/import", requireAuth, async (req, res): Promise<void> => {
  const parsed = ImportLegacyPostsBody.safeParse(req.body);
  if (!parsed.success) {
    const response: ErrorResponse = { error: "The post import batch is invalid." };
    res.status(400).json(response);
    return;
  }

  const items = parsed.data.posts;
  const sourceIds = items.map((item) => item.sourceId);
  if (new Set(sourceIds).size !== sourceIds.length) {
    const response: ErrorResponse = { error: "An import batch cannot contain duplicate post IDs." };
    res.status(400).json(response);
    return;
  }

  const { userId } = getAuthContext(res);
  const inserted = await db
    .insert(postsTable)
    .values(items.map((item) => ({
      authorId: userId,
      sourceId: item.sourceId,
      text: item.text.trim(),
      createdAt: new Date(item.createdAt),
    })))
    .onConflictDoNothing({
      target: [postsTable.authorId, postsTable.sourceId],
    })
    .returning({ id: postsTable.id, sourceId: postsTable.sourceId });
  const insertedIds = new Set(inserted.map((post) => post.sourceId));
  const persisted = await db
    .select({
      id: postsTable.id,
      sourceId: postsTable.sourceId,
      text: postsTable.text,
    })
    .from(postsTable)
    .where(
      and(
        eq(postsTable.authorId, userId),
        inArray(postsTable.sourceId, sourceIds),
      ),
    );
  const bySourceId = new Map(persisted.map((post) => [post.sourceId, post]));
  const results = items.map((item) => {
    const saved = bySourceId.get(item.sourceId);
    if (!saved) {
      throw new Error("An imported post could not be confirmed after saving.");
    }
    return {
      sourceId: item.sourceId,
      postId: saved.id,
      outcome: insertedIds.has(item.sourceId)
        ? "imported" as const
        : saved.text === item.text.trim()
          ? "already-imported" as const
          : "conflict" as const,
    };
  });
  const response: PostImportResponse = { results };
  res.json(response);
  refreshCreatorsAfterActivity([userId]);
});

router.put("/posts/:id/like", requireAuth, async (req, res): Promise<void> => {
  const params = LikePostParams.safeParse(req.params);
  if (!params.success) {
    const response: ErrorResponse = { error: "Post not found." };
    res.status(404).json(response);
    return;
  }

  const { userId } = getAuthContext(res);
  const [post] = await db
    .select({ id: postsTable.id, authorId: postsTable.authorId })
    .from(postsTable)
    .where(eq(postsTable.id, params.data.id))
    .limit(1);
  if (!post) {
    const response: ErrorResponse = { error: "Post not found." };
    res.status(404).json(response);
    return;
  }

  await db
    .insert(postLikesTable)
    .values({ userId, postId: params.data.id })
    .onConflictDoNothing();
  const response: LikeResponse = {
    liked: true,
    likeCount: await currentLikeCount(params.data.id),
  };
  res.json(response);
  refreshCreatorsAfterActivity([userId, post.authorId]);
});

router.delete("/posts/:id/like", requireAuth, async (req, res): Promise<void> => {
  const params = UnlikePostParams.safeParse(req.params);
  if (!params.success) {
    const response: ErrorResponse = { error: "Post not found." };
    res.status(404).json(response);
    return;
  }

  const { userId } = getAuthContext(res);
  const [post] = await db
    .select({ id: postsTable.id })
    .from(postsTable)
    .where(eq(postsTable.id, params.data.id))
    .limit(1);
  if (!post) {
    const response: ErrorResponse = { error: "Post not found." };
    res.status(404).json(response);
    return;
  }

  await db
    .delete(postLikesTable)
    .where(
      and(
        eq(postLikesTable.userId, userId),
        eq(postLikesTable.postId, params.data.id),
      ),
    );
  const response: LikeResponse = {
    liked: false,
    likeCount: await currentLikeCount(params.data.id),
  };
  res.json(response);
});

router.delete("/posts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeletePostParams.safeParse(req.params);
  if (!params.success) {
    const response: ErrorResponse = { error: "Post not found." };
    res.status(404).json(response);
    return;
  }

  const { userId } = getAuthContext(res);
  const [deleted] = await db
    .delete(postsTable)
    .where(
      and(
        eq(postsTable.id, params.data.id),
        eq(postsTable.authorId, userId),
      ),
    )
    .returning({ id: postsTable.id });

  if (!deleted) {
    const response: ErrorResponse = { error: "Post not found." };
    res.status(404).json(response);
    return;
  }

  res.status(204).end();
});

router.get("/users/search", requireAuth, async (req, res): Promise<void> => {
  const params = SearchUsersQueryParams.safeParse(req.query);
  const query = params.success ? params.data.query.trim() : "";
  if (!params.success || query.length < 2) {
    const response: ErrorResponse = { error: "Enter at least two characters to search." };
    res.status(400).json(response);
    return;
  }

  const pattern = query.replace(/[\\%_]/g, "\\$&");
  const users = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(
      or(
        ilike(usersTable.username, `%${pattern}%`),
        ilike(usersTable.displayName, `%${pattern}%`),
      ),
    )
    .orderBy(usersTable.username)
    .limit(MAX_SEARCH_RESULTS);

  const response: UserSearchResults = {
    profiles: users.map(publicProfile),
  };
  res.json(response);
});

router.get("/profiles/:username", requireAuth, async (req, res): Promise<void> => {
  const params = GetUserProfileParams.safeParse(req.params);
  if (!params.success) {
    const response: ErrorResponse = { error: "Profile not found." };
    res.status(404).json(response);
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, params.data.username.toLowerCase()))
    .limit(1);
  if (!user) {
    const response: ErrorResponse = { error: "Profile not found." };
    res.status(404).json(response);
    return;
  }

  const [countResult, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(postsTable)
      .where(eq(postsTable.authorId, user.id)),
    listPostRows(MAX_PROFILE_POSTS, user.id),
  ]);
  const { userId } = getAuthContext(res);
  const response: ProfileResponse = {
    profile: publicProfile(user),
    posts: await postsForViewer(rows, userId),
    postCount: Number(countResult[0]?.count ?? 0),
  };
  res.json(response);
});

export default router;
