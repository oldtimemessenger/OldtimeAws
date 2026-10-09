import test from "node:test";
import assert from "node:assert/strict";
import {captureChoice} from "./creative-capture-modes.js";
test("swipe choices select capture type and audience destination without taking a picture",()=>{
  assert.deepEqual(captureChoice("story"),{capture:"photo",destination:"story",quote:false});
  assert.deepEqual(captureChoice("video"),{capture:"video",destination:"post",quote:false});
  assert.equal(captureChoice("carousel").capture,"photo");assert.equal(captureChoice("quote").quote,true);
  assert.throws(()=>captureChoice("unsupported"));
});
