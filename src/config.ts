/**
 * 站点全局配置 —— 改这里就能改全站，不用翻每个页面
 */
export const SITE = {
  /** 社团名，会用在导航、页脚、首页大标题 */
  name: 'G2333 动漫社',
  /** 一句话介绍 */
  tagline: '一起看番、一起画画、一起摆摊',
  /** 首页介绍段落 */
  description:
    '我们是 G2333，一个以动画、漫画、游戏与同人创作为核心的兴趣社团。每周有固定放映，每学期有合宿与漫展出摊，欢迎所有喜欢二次元的人加入。',
  /** 招募信息 */
  recruit: '常年招新，不限年级、不限作品偏好。',
  /** 联系方式，按实际情况改 */
  contact: {
    qq: '123456789',
    email: 'hello@example.com',
    bilibili: 'https://space.bilibili.com/000000',
  },
} as const;

/** 顶部导航 */
export const NAV = [
  { href: '/', label: '首页' },
  { href: '/activities/', label: '社团活动' },
  { href: '/blog/', label: '文章' },
  { href: '/gallery/', label: '作品展示' },
] as const;
