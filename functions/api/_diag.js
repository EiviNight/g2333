// 临时诊断接口：列出运行时实际可用的绑定名。
// 排查完绑定问题后应当删除。
import { json, bucketOf, dbOf } from '../_auth.js';

export async function onRequestGet({ env }) {
  const names = Object.keys(env).sort();
  const bucket = bucketOf(env);
  const db = dbOf(env);

  return json({
    ok: true,
    allEnvKeys: names,
    resolvedBucket: bucket ? names.find((n) => env[n] === bucket) || '(found)' : null,
    resolvedDb: db ? names.find((n) => env[n] === db) || '(found)' : null,
    dbLooksLikeBinding: db ? typeof db.prepare === 'function' : false,
    bucketLooksLikeBinding: bucket ? typeof bucket.get === 'function' : false,
  });
}
