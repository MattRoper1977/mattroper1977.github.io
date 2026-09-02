#!/usr/bin/env python3
"""Deliberately broken copies for red runs. Usage: break.py <variant> ; writes _tfr2/broken/<variant>.html"""
import sys,pathlib
HERE=pathlib.Path(__file__).resolve().parent.parent
src=(HERE/'titanforge.html').read_text(encoding='utf-8')
variants={
 'boss-brace': ('elapsed>=(this.bossRep?1400:750)','elapsed>=(this.bossRep?1000:750)'),
 'combo-window': ('window.__MBM_TITAN_COMBO_WINDOW__=(state.training.advanced?7000:2500)','window.__MBM_TITAN_COMBO_WINDOW__=(state.training.advanced?300:2500)'),
 'lift-inflow': ('.game-shell .arena>.lift-console .lift-button{position:fixed!important;','.game-shell .arena>.lift-console .lift-button{position:relative!important;'),
 'network-leak': ('<div id="game-root"></div>','<div id="game-root"></div><img src="https://example.invalid/pixel.gif" alt="">'),
 'graphics-on': ('graphics:{enabled:false}','graphics:{enabled:true}'),
 'duel-fingerprint': ('"a=fingerprint:sha-256 "+fp,','"a=fingerprint:sha-256 "+fp.slice(3),'),
}
v=sys.argv[1];old,new=variants[v]
assert src.count(old)==1,(v,src.count(old))
out=HERE/'broken';out.mkdir(exist_ok=True)
(out/(v+'.html')).write_text(src.replace(old,new),encoding='utf-8');print('wrote',out/(v+'.html'))
