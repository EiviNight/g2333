// /api/activities
//   GET   列表（未登录只返回 published，已登录返回全部含草稿）
//   POST  新建（需登录）   { title, summary, body, location, event_date, tags, cover, status, id? }
import { makeContentHandlers } from '../_content.js';

const h = makeContentHandlers('activities');

export const onRequestGet = h.listHandler;
export const onRequestPost = h.createHandler;
