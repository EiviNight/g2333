/**
 * 浏览器端共享工具：从 API 拉数据、把列表和详情渲染出来。
 *
 * 站点是静态的，所以列表/详情在浏览器里异步加载。
 * 各页面只负责给出「数据源」和「渲染到哪个容器」，渲染细节统一在这里，
 * 避免每个页面各写一份 DOM 拼装代码。
 */

export type ContentItem = {
  id: string;
  title: string;
  summary: string;
  tags: string;
  cover: string;
  status: string;
  event_date?: string;
  created_at?: number;
  location?: string;
  author?: string;
};

export type ImageItem = {
  id: string;
  title: string;
  author: string;
  url: string;
  status: string;
  created_at: number;
};

export const STATUS_LABEL: Record<string, string> = {
  published: '已发布',
  draft: '草稿',
  approved: '已显示',
  pending: '待审',
  hidden: '已隐藏',
};

/** 统一的 JSON 请求封装 */
export async function api<T = any>(path: string, init?: RequestInit): Promise<{ res: Response; data: T }> {
  const res = await fetch(path, { credentials: 'same-origin', ...init });
  const data = (await res.json().catch(() => ({}))) as T;
  return { res, data };
}

export function formatDate(value?: string | number): string {
  if (value == null || value === '') return '';
  const v = String(value);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : new Date(value as any);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function splitTags(raw: string): string[] {
  return String(raw || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** 给列表容器渲染「加载中 / 空 / 错误」三种状态 */
export function setListState(
  statusEl: HTMLElement | null,
  text: string,
  state?: 'pending' | 'err' | 'ok',
): void {
  if (!statusEl) return;
  statusEl.hidden = false;
  statusEl.textContent = text;
  if (state) statusEl.dataset.state = state;
}

/**
 * 渲染内容卡片列表（活动 / 文章共用）。
 * 卡片是 <a>，点进去是对应的详情页。
 *
 * detailPath 是详情页路径，形如 '/activities/detail/'，卡片拼成
 * '<detailPath>?id=<条目id>'。站点是静态构建，做不到干净的
 * /activities/<id>/，原因见 components/ContentDetail.astro 顶部注释。
 */
export function renderContentList(
  container: HTMLElement,
  items: ContentItem[],
  detailPath: string,
): void {
  container.replaceChildren();

  for (const item of items) {
    const link = el('a', 'card content-card');
    link.href = `${detailPath}?id=${encodeURIComponent(item.id)}`;

    const head = el('div', 'content-head');
    const dateText = item.event_date ? formatDate(item.event_date) : formatDate(item.created_at);
    if (dateText) {
      const time = el('time', undefined, dateText);
      head.append(time);
    }
    if (item.location) head.append(el('span', 'muted', `· ${item.location}`));
    if (item.status !== 'published') {
      head.append(el('span', 'badge', STATUS_LABEL[item.status] || item.status));
    }
    link.append(head);

    link.append(el('h3', undefined, item.title));
    if (item.summary) link.append(el('p', 'muted', item.summary));

    const tags = splitTags(item.tags);
    if (tags.length) {
      const ul = el('ul', 'tags');
      for (const t of tags) ul.append(el('li', undefined, t));
      link.append(ul);
    }

    container.append(link);
  }

  container.hidden = items.length === 0;
}

/** 渲染作品网格（画廊 / 后台预览共用） */
export function renderImageGrid(
  container: HTMLElement,
  items: ImageItem[],
  opts: { showStatus?: boolean } = {},
): void {
  container.replaceChildren();

  for (const item of items) {
    const fig = el('figure', 'work');

    const img = el('img');
    img.src = item.url;
    img.alt = item.title;
    img.loading = 'lazy';
    img.decoding = 'async';
    fig.append(img);

    const cap = el('figcaption');
    cap.append(el('span', undefined, item.title));
    if (item.author) cap.append(el('em', undefined, item.author));
    if (opts.showStatus && item.status !== 'approved') {
      cap.append(el('em', 'badge', STATUS_LABEL[item.status] || item.status));
    }
    fig.append(cap);

    container.append(fig);
  }

  container.hidden = items.length === 0;
}

/** 读取 URL 查询参数 */
export function queryParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

/** 转义成安全的 HTML 片段（详情页拼标题时用） */
export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
