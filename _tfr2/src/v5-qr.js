(function(){
  "use strict";
  /* TFR2 P4 — QR ENCODER only (byte mode, EC L/M, versions 1-25, mask by penalty). No scanner, no camera. */
  if(window.__MBM_TITAN_QR__)return;
  var EXP=new Array(256),LOG=new Array(256);(function(){var x=1;for(var i=0;i<255;i++){EXP[i]=x;LOG[x]=i;x<<=1;if(x&256)x^=0x11d;}EXP[255]=EXP[0];})();
  function gmul(a,b){if(!a||!b)return 0;return EXP[(LOG[a]+LOG[b])%255];}
  function genPoly(n){var g=[1];for(var i=0;i<n;i++){var ng=new Array(g.length+1).fill(0);for(var j=0;j<g.length;j++){ng[j]^=g[j];ng[j+1]^=gmul(g[j],EXP[i]);}g=ng;}return g;}
  function rsEncode(data,ecLen){var g=genPoly(ecLen),res=data.concat(new Array(ecLen).fill(0));for(var i=0;i<data.length;i++){var c=res[i];if(!c)continue;for(var j=1;j<g.length;j++)res[i+j]^=gmul(g[j],c);}return res.slice(data.length);}
  /* [count,total,data] blocks per version for L then M */
  var RS={
    1:[[[1,26,19]],[[1,26,16]]],2:[[[1,44,34]],[[1,44,28]]],3:[[[1,70,55]],[[1,70,44]]],4:[[[1,100,80]],[[2,50,32]]],5:[[[1,134,108]],[[2,67,43]]],
    6:[[[2,86,68]],[[4,43,27]]],7:[[[2,98,78]],[[4,49,31]]],8:[[[2,121,97]],[[2,60,38],[2,61,39]]],9:[[[2,146,116]],[[3,58,36],[2,59,37]]],10:[[[2,86,68],[2,87,69]],[[4,69,43],[1,70,44]]],
    11:[[[4,101,81]],[[1,80,50],[4,81,51]]],12:[[[2,116,92],[2,117,93]],[[6,58,36],[2,59,37]]],13:[[[4,133,107]],[[8,59,37],[1,60,38]]],14:[[[3,145,115],[1,146,116]],[[4,64,40],[5,65,41]]],15:[[[5,109,87],[1,110,88]],[[5,65,41],[5,66,42]]],
    16:[[[5,122,98],[1,123,99]],[[7,73,45],[3,74,46]]],17:[[[1,135,107],[5,136,108]],[[10,74,46],[1,75,47]]],18:[[[5,150,120],[1,151,121]],[[9,69,43],[4,70,44]]],19:[[[3,141,113],[4,142,114]],[[3,70,44],[11,71,45]]],20:[[[3,135,107],[5,136,108]],[[3,67,41],[13,68,42]]],
    21:[[[4,144,116],[4,145,117]],[[17,68,42]]],22:[[[2,139,111],[7,140,112]],[[17,74,46]]],23:[[[4,151,121],[5,152,122]],[[4,75,47],[14,76,48]]],24:[[[6,147,117],[4,148,118]],[[6,73,45],[14,74,46]]],25:[[[8,132,106],[4,133,107]],[[8,75,47],[13,76,48]]]
  };
  var ALIGN={2:[6,18],3:[6,22],4:[6,26],5:[6,30],6:[6,34],7:[6,22,38],8:[6,24,42],9:[6,26,46],10:[6,28,50],11:[6,30,54],12:[6,32,58],13:[6,34,62],14:[6,26,46,66],15:[6,26,48,70],16:[6,26,50,74],17:[6,30,54,78],18:[6,30,56,82],19:[6,30,58,86],20:[6,34,62,90],21:[6,28,50,72,94],22:[6,26,50,74,98],23:[6,30,54,78,102],24:[6,28,54,80,106],25:[6,32,58,84,110]};
  function dataCapacity(v,lvl){var t=0;RS[v][lvl].forEach(function(b){t+=b[0]*b[2];});return t;}
  function formatBits(lvl,mask){var data=((lvl===0?1:0)<<3)|mask;var rem=data<<10;for(var i=14;i>=10;i--)if(rem&(1<<i))rem^=0x537<<(i-10);return ((data<<10)|rem)^0x5412;}
  function versionBits(v){var rem=v<<12;for(var i=17;i>=12;i--)if(rem&(1<<i))rem^=0x1f25<<(i-12);return (v<<12)|rem;}
  function encodeBytes(text){var out=[];for(var i=0;i<text.length;i++){var c=text.charCodeAt(i);if(c<128)out.push(c);else if(c<2048){out.push(192|(c>>6),128|(c&63));}else{out.push(224|(c>>12),128|((c>>6)&63),128|(c&63));}}return out;}
  function build(text){
    var bytes=encodeBytes(text),lvl=1,v;
    for(v=1;v<=25;v++){if(dataCapacity(v,1)>=bytes.length+(v<10?2:3))break;}
    if(v>20){for(v=1;v<=25;v++){if(dataCapacity(v,0)>=bytes.length+(v<10?2:3)){lvl=0;break;}}}
    if(v>25)throw new Error("QR payload too long");
    var cap=dataCapacity(v,lvl),bits=[];function push(val,n){for(var i=n-1;i>=0;i--)bits.push((val>>i)&1);}
    push(4,4);push(bytes.length,v<10?8:16);bytes.forEach(function(b){push(b,8);});
    var maxBits=cap*8;push(0,Math.min(4,maxBits-bits.length));while(bits.length%8)bits.push(0);
    var cw=[];for(var i=0;i<bits.length;i+=8){var b=0;for(var j=0;j<8;j++)b=(b<<1)|bits[i+j];cw.push(b);}
    for(var p=0;cw.length<cap;p++)cw.push(p%2?0x11:0xec);
    var blocks=[],ecBlocks=[],pos=0;RS[v][lvl].forEach(function(spec){for(var k=0;k<spec[0];k++){var d=cw.slice(pos,pos+spec[2]);pos+=spec[2];blocks.push(d);ecBlocks.push(rsEncode(d,spec[1]-spec[2]));}});
    var seq=[],maxD=Math.max.apply(null,blocks.map(function(b){return b.length;})),maxE=ecBlocks[0].length;
    for(var i2=0;i2<maxD;i2++)blocks.forEach(function(b){if(i2<b.length)seq.push(b[i2]);});
    for(var i3=0;i3<maxE;i3++)ecBlocks.forEach(function(b){seq.push(b[i3]);});
    var n=v*4+17,m=[],f=[];for(var r=0;r<n;r++){m.push(new Array(n).fill(0));f.push(new Array(n).fill(false));}
    function set(r,c,val){m[r][c]=val?1:0;f[r][c]=true;}
    function finder(r0,c0){for(var r=-1;r<=7;r++)for(var c=-1;c<=7;c++){var rr=r0+r,cc=c0+c;if(rr<0||cc<0||rr>=n||cc>=n)continue;var on=(r>=0&&r<=6&&c>=0&&c<=6)&&(r===0||r===6||c===0||c===6||(r>=2&&r<=4&&c>=2&&c<=4));set(rr,cc,on);}}
    finder(0,0);finder(0,n-7);finder(n-7,0);
    for(var i4=8;i4<n-8;i4++){set(6,i4,i4%2===0);set(i4,6,i4%2===0);}
    (ALIGN[v]||[]).forEach(function(ar){(ALIGN[v]||[]).forEach(function(ac){if((ar<=8&&ac<=8)||(ar<=8&&ac>=n-9)||(ar>=n-9&&ac<=8))return;for(var r=-2;r<=2;r++)for(var c=-2;c<=2;c++)set(ar+r,ac+c,Math.max(Math.abs(r),Math.abs(c))!==1);});});
    for(var i5=0;i5<9;i5++){f[8][i5]=true;f[i5][8]=true;}for(var i6=0;i6<8;i6++){f[n-1-i6][8]=true;f[8][n-1-i6]=true;}set(n-8,8,1);
    if(v>=7){var vb=versionBits(v);for(var i7=0;i7<18;i7++){var bit=(vb>>i7)&1,a=Math.floor(i7/3),b2=i7%3;set(a,n-11+b2,bit);set(n-11+b2,a,bit);}}
    var idx=0,up=true;for(var col=n-1;col>0;col-=2){if(col===6)col--;for(var k2=0;k2<n;k2++){var row=up?n-1-k2:k2;for(var dc=0;dc<2;dc++){var cc2=col-dc;if(f[row][cc2])continue;var bit2=idx<seq.length*8?(seq[idx>>3]>>(7-(idx&7)))&1:0;m[row][cc2]=bit2;idx++;}}up=!up;}
    function masked(mask){var out=m.map(function(row){return row.slice();});for(var r=0;r<n;r++)for(var c=0;c<n;c++){if(f[r][c])continue;var inv;switch(mask){case 0:inv=(r+c)%2===0;break;case 1:inv=r%2===0;break;case 2:inv=c%3===0;break;case 3:inv=(r+c)%3===0;break;case 4:inv=(Math.floor(r/2)+Math.floor(c/3))%2===0;break;case 5:inv=(r*c)%2+(r*c)%3===0;break;case 6:inv=((r*c)%2+(r*c)%3)%2===0;break;default:inv=((r+c)%2+(r*c)%3)%2===0;}if(inv)out[r][c]^=1;}
      var fb=formatBits(lvl,mask);for(var i=0;i<15;i++){var bt=(fb>>i)&1;if(i<6)out[i][8]=bt;else if(i<8)out[i+1][8]=bt;else out[n-15+i][8]=bt;if(i<8)out[8][n-1-i]=bt;else if(i<9)out[8][15-i]=bt;else out[8][14-i]=bt;}out[n-8][8]=1;return out;}
    function penalty(g){var s=0,r,c;for(r=0;r<n;r++){var run=1;for(c=1;c<n;c++){if(g[r][c]===g[r][c-1]){run++;if(run===5)s+=3;else if(run>5)s++;}else run=1;}}for(c=0;c<n;c++){var run2=1;for(r=1;r<n;r++){if(g[r][c]===g[r-1][c]){run2++;if(run2===5)s+=3;else if(run2>5)s++;}else run2=1;}}
      for(r=0;r<n-1;r++)for(c=0;c<n-1;c++){var q=g[r][c];if(q===g[r][c+1]&&q===g[r+1][c]&&q===g[r+1][c+1])s+=3;}
      var P=[1,0,1,1,1,0,1,0,0,0,0],Q=[0,0,0,0,1,0,1,1,1,0,1];for(r=0;r<n;r++)for(c=0;c<=n-11;c++){var a1=true,b1=true,a2=true,b2=true;for(var i=0;i<11;i++){if(g[r][c+i]!==P[i])a1=false;if(g[r][c+i]!==Q[i])b1=false;if(g[c+i][r]!==P[i])a2=false;if(g[c+i][r]!==Q[i])b2=false;}s+=(a1?40:0)+(b1?40:0)+(a2?40:0)+(b2?40:0);}
      var dark=0;for(r=0;r<n;r++)for(c=0;c<n;c++)dark+=g[r][c];var pct=dark*100/(n*n),prev=Math.floor(pct/5)*5,next=prev+5;s+=Math.min(Math.abs(prev-50),Math.abs(next-50))/5*10;return s;}
    var best=null,bestScore=1e12,bestMask=0;for(var mk=0;mk<8;mk++){var g2=masked(mk),sc=penalty(g2);if(sc<bestScore){bestScore=sc;best=g2;bestMask=mk;}}
    return {size:n,version:v,level:lvl===0?"L":"M",mask:bestMask,modules:best,codewords:seq,data:cw};
  }
  function draw(canvas,text,scale,quiet){var q=build(text),qz=quiet===undefined?4:quiet,px=(q.size+qz*2)*scale;canvas.width=px;canvas.height=px;canvas.style.width=px+"px";canvas.style.height=px+"px";var ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,px,px);ctx.fillStyle="#000";for(var r=0;r<q.size;r++)for(var c=0;c<q.size;c++)if(q.modules[r][c])ctx.fillRect((c+qz)*scale,(r+qz)*scale,scale,scale);return q;}
  window.__MBM_TITAN_QR__={build:build,draw:draw,version:"1.0.0"};
})();
