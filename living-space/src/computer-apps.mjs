const paths={
 work:'<rect x="4" y="6" width="24" height="17" rx="3"/><path d="M11 27h10M16 23v4M9 11h8M9 15h13"/>',
 focus:'<circle cx="16" cy="17" r="10"/><path d="M16 11v7l4 2M7 5l-3 4M25 5l3 4M10 27l-2 2M22 27l2 2"/>',
 fish:'<path d="M6 16c5-9 12-9 18 0-6 9-13 9-18 0ZM24 16l5-5v10Z"/><circle cx="12" cy="14" r="1"/>',
 snake:'<rect x="3" y="8" width="26" height="17" rx="5"/><path d="M9 13v7M5.5 16.5h7M21 14h.1M25 19h.1M15 8V5h5"/>',
 phone:'<rect x="8" y="3" width="16" height="26" rx="4"/><path d="M13 7h6M14 25h4"/><rect x="11" y="11" width="4" height="4" rx="1"/><rect x="17" y="11" width="4" height="4" rx="1"/><path d="M11 20h10"/>',
 close:'<path d="M16 3v12M9 7a12 12 0 1 0 14 0"/>'
};
const apps=[['work','工作位','回到工作位','继续桌边陪伴'],['focus','专注闹钟','打开专注闹钟','开始一段专注'],['fish','点点乐','玩点点乐','十五秒轻松一下'],['snake','贪吃蛇','玩贪吃蛇','打开红蓝掌机'],['phone','翻翻乐','手机翻翻乐','打开桌边手机'],['close','收起电脑','返回小屋','返回小屋']];
export function computerAppsMarkup(){return '<div class="game-heading computer-desktop-heading"><strong>书桌电脑</strong><span>选择一个应用</span></div><div class="computer-choices computer-app-grid" role="group" aria-label="电脑应用">'+apps.map(([action,name,label,hint])=>`<button class="computer-app" data-game-action="${action}" aria-label="${label}" title="${hint}"><span class="computer-app-icon" data-app="${action}" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[action]}</svg></span><span class="computer-app-name">${name}</span></button>`).join('')+'</div>';}
