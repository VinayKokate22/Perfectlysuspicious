// Hash routes also work on static hosting, without server rewrite rules.
export function readRoute(href) {
  const url=new URL(href),path=url.hash.slice(1);
  if(/^\/(?:create|quick|practice)$/.test(path)||path==='/join')return path;
  const room=path.match(/^\/(room|join)\/([a-f0-9]{6})$/i);
  if(room)return `/${room[1].toLowerCase()}/${room[2].toUpperCase()}`;
  const invite=url.searchParams.get('room');
  return !path&&/^[a-f0-9]{6}$/i.test(invite??'')?`/join/${invite.toUpperCase()}`:'/';
}

export class GameNavigation {
  constructor(onChange,win=window) {
    this.win=win;this.onChange=onChange;this.current=readRoute(win.location.href);
    // A directly opened invite/practice link gets an in-game Back destination.
    if(this.current!=='/'&&!win.history.state?.gameRoute){
      this.write('/','replaceState');this.write(this.current,'pushState');
    }else this.write(this.current,'replaceState');
    const changed=()=>{
      const next=readRoute(win.location.href);
      if(next===this.current)return;
      this.current=next;this.onChange(next);
    };
    win.addEventListener('popstate',changed);win.addEventListener('hashchange',changed);
  }
  write(route,method) {
    const url=new URL(this.win.location.href);url.searchParams.delete('room');url.hash=route;
    this.win.history[method]({...this.win.history.state,gameRoute:route},'',url);
  }
  go(route,{replace=false}={}) {
    if(route===this.current)return;
    this.current=route;this.write(route,replace?'replaceState':'pushState');
  }
}
