// /api/activities/[id]
//   GET     详情（草稿仅登录后可见）
//   PATCH   编辑（需登录）
//   DELETE  删除（需登录）
import { makeContentHandlers } from '../../_content.js';

const h = makeContentHandlers('activities');

export const onRequestGet = h.getOneHandler;
export const onRequestPatch = h.updateHandler;
export const onRequestDelete = h.deleteHandler;
