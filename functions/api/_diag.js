// 临时诊断接口：列出运行时实际可用的绑定名。
// 排查完绑定问题后应当删除。
import { json, bucketOf, dbOf } from '../_auth.js';

export async function onRequestGet({ env }) {
  const names = Object.keys(env).sort();
  const report = {};

  for (const name of names) {
    const value = env[name];
    let kind = typeof value;
    if (value === null) kind = 'null';
    else if (typeof value === 'object') {
      // 只报告形态，不泄漏值
      const hasPrepare = typeof value.prepare === 'function';
      const hasGet = typeof value.get === 'function';
      const hasPut = typeof value.put === 'function';
      if (hasPrepare) kind = 'D1-like';
      else if (hasGet && hasPut) kind = 'R2-like';
      else kind = 'object{' + Object.keys(value).slice(0, 6).join(',') + '}';
    }
    report[name] = kind;
  }

  return json({
    ok: true,
    allEnvKeys: names,
    envShape: report,
    resolvedBucket: bucketOf(env) ? 'yes' : 'no',
    resolvedDb: dbOf(env) ? 'yes' : 'no',
  });
}
