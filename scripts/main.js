const ID="persistent-afflictions";
const DICE=[4,6,8,10,12];
const TYPES={laceration:{name:"Laceration",damage:"slashing"},burning:{name:"Burning",damage:"fire"},poison:{name:"Poison",damage:"poison"},rot:{name:"Rot",damage:"necrotic"},corrosion:{name:"Corrosion",damage:"acid"},frostbite:{name:"Frostbite",damage:"cold"},"psychic-strain":{name:"Psychic Strain",damage:"psychic"},shock:{name:"Shock",damage:"lightning"}};
const f=(doc,key,def)=>doc.getFlag(ID,key)??def;
const esc=s=>foundry.utils.escapeHTML(String(s));
const owned=()=>game.user.isGM;
function current(actor,type){return (actor.effects?.contents??[]).find(e=>e.getFlag(ID,"type")===type);}
function actorFromToken(token){return token?.actor??null;}
async function safeUpdate(effect,data){if(!owned())return;await effect.update(data);}
async function apply(actor,type,die=4){
 if(!owned())return ui.notifications.warn("Only the GM can change persistent afflictions in this version.");
 if(!actor||!TYPES[type])return;
 const existing=current(actor,type);let old=existing?Number(f(existing,"die",4)):0;
 if(existing){const index=DICE.indexOf(old);if(index===4){await overflow(actor,type,existing);return;}
  await safeUpdate(existing,{name:`${TYPES[type].name} (d${DICE[index+1]})`,[`flags.${ID}.die`]:DICE[index+1]});return;
 }
 const size=DICE.includes(Number(die))?Number(die):4;
 await actor.createEmbeddedDocuments("ActiveEffect",[{name:`${TYPES[type].name} (d${size})`,img:"icons/svg/blood.svg",disabled:false,transfer:false,changes:[],flags:{[ID]:{type,die:size,overflow:0}}}]);
}
async function step(actor,type,delta){if(!owned())return;const e=current(actor,type);if(!e){if(delta>0)await apply(actor,type,4);return;}let i=DICE.indexOf(Number(f(e,"die",4)));if(delta>0){await apply(actor,type);return;}if(i<=0)await e.delete();else await e.update({name:`${TYPES[type].name} (d${DICE[i-1]})`,[`flags.${ID}.die`]:DICE[i-1]});}
async function damage(actor,formula,type,flavor){const roll=await new Roll(formula).evaluate();await roll.toMessage({speaker:ChatMessage.getSpeaker({actor}),flavor:`${flavor} — ${type} damage`});
 if(game.settings.get(ID,"autoDamage")&&owned()){
  const hp=Number(actor.system?.attributes?.hp?.value);if(Number.isFinite(hp))await actor.update({"system.attributes.hp.value":Math.max(0,hp-roll.total)});
 }
 return roll;
}
async function overflow(actor,type,e){const count=Number(f(e,"overflow",0))+1;await e.setFlag(ID,"overflow",count);
 const msg={laceration:"Immediate 1d4 slashing damage",burning:"Immediate 1d8 fire damage",poison:`Next attack or save: -${2*count} (consumed after roll)`,rot:`Strength and Dexterity saves: -${count} until end of next turn`,corrosion:`Persistent AC penalty: -${count}; remains after active corrosion is removed`,frostbite:`No reactions until end of next turn; speed -${5*count} ft`,"psychic-strain":`Intelligence, Wisdom, Charisma saves: -${count} until end of next turn`,shock:`No reactions; attacks and saves -${count} until start of next turn`}[type];
 if(type==="laceration")await damage(actor,"1d4","slashing","Laceration overflow");
 if(type==="burning")await damage(actor,"1d8","fire","Burning overflow");
 if(type==="corrosion")await actor.setFlag(ID,"corrosionScar",Number(f(actor,"corrosionScar",0))+1);
 await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),content:`<div class="pa-overflow"><h3>${esc(TYPES[type].name)} — Overflow Stage ${count}</h3><p>${esc(msg)}</p><p>Persistent die remains at <strong>d12</strong>. Apply any non-damage effects manually.</p></div>`});
}
async function tick(actor){if(!owned())return;for(const [type,def] of Object.entries(TYPES)){
 const e=current(actor,type);if(!e||e.disabled)continue;
 const die=Number(f(e,"die",4));if(!DICE.includes(die))continue;
 await damage(actor,`1d${die}`,def.damage,`${def.name} persistent damage`);
 if(e.parent&&actor.effects.get(e.id))await step(actor,type,-1);
 }}
function controls(actor){const items=Object.entries(TYPES).map(([key,def])=>{const e=current(actor,key);const die=e?`d${f(e,"die",4)}`:"—";return `<div class="pa-line"><strong>${esc(def.name)}</strong><span>${die}</span><button type="button" data-pa="add" data-type="${key}">+</button><button type="button" data-pa="down" data-type="${key}">−</button></div>`;}).join("");return `<div class="pa-panel"><p>GM condition controls. + reapplies or overflows at d12; − steps down.</p>${items}<hr/><button type="button" data-pa="tick">Resolve start-of-turn damage</button><button type="button" data-pa="clear-scar">Clear corrosion AC scars (${Number(f(actor,"corrosionScar",0))})</button></div>`;}
async function showActor(actor){if(!actor)return ui.notifications.warn("Select a token or open an actor first.");const w=new foundry.applications.api.DialogV2({window:{title:`Afflictions — ${actor.name}`},content:controls(actor),buttons:[{action:"close",label:"Close",default:true}],render:(_ev,el)=>{el.querySelectorAll("[data-pa]").forEach(b=>b.addEventListener("click",async()=>{let action=b.dataset.pa,type=b.dataset.type;try{if(action==="add")await apply(actor,type);if(action==="down")await step(actor,type,-1);if(action==="tick")await tick(actor);if(action==="clear-scar")await actor.unsetFlag(ID,"corrosionScar");w.close();await showActor(actor);}catch(err){console.error(ID,err);ui.notifications.error(err.message);}}));}});await w.render(true);}
function selectedActor(){return canvas?.tokens?.controlled?.[0]?.actor??null;}
function openPanel(){showActor(selectedActor());}
function itemAffliction(item){return f(item,"weaponAffliction",null);}
async function configureItem(item){if(!owned())return;const value=itemAffliction(item)||{};const choices=Object.entries(TYPES).map(([k,v])=>`<option value="${k}" ${value.type===k?"selected":""}>${v.name}</option>`).join("");
 const result=await foundry.applications.api.DialogV2.wait({window:{title:`Affliction configuration — ${item.name}`},content:`<div class="pa-config"><label><input id="pa-enabled" type="checkbox" ${value.enabled?"checked":""}/> Apply on a confirmed hit (GM-triggered)</label><label>Condition <select id="pa-type">${choices}</select></label><label>Initial die <select id="pa-die">${DICE.map(d=>`<option value="${d}" ${Number(value.die||4)===d?"selected":""}>d${d}</option>`).join("")}</select></label><p>Weapon application is a GM action, not an automatic hit detector in this release.</p></div>`,buttons:[{action:"save",label:"Save",default:true,callback:(_ev,b)=>({enabled:b.form.elements["pa-enabled"]?.checked??b.querySelector("#pa-enabled")?.checked,type:b.querySelector("#pa-type")?.value,die:Number(b.querySelector("#pa-die")?.value)})},{action:"cancel",label:"Cancel"}]});if(result)await item.setFlag(ID,"weaponAffliction",result);
}
async function importCatalog(){if(!owned())return;const res=await fetch(`modules/${ID}/scripts/spells.json`);if(!res.ok)throw Error("Spell catalog file unavailable");const spells=await res.json();let pack=game.packs.get(`${ID}.spells`);
 if(!pack){pack=await CompendiumCollection.createCompendium({type:"Item",label:"Persistent Afflictions — Spell Reference",name:"persistent-afflictions-spells",package:"world"});}
 const existing=new Set(pack.index.map(x=>x.name));const docs=spells.filter(x=>!existing.has(x.name)).map(x=>({name:x.name,type:"spell",img:"icons/svg/book.svg",system:{level:x.level,description:{value:`<p><em>Reference entry from Persistent Damage & Afflictions.</em></p><p>${esc(x.text).replaceAll("\n","<br>")}</p><p><strong>Automation:</strong> Apply or manipulate conditions through the GM Afflictions panel. This entry does not automatically execute complex spell interactions.</p>`}},flags:{[ID]:{reference:true}}}));
 if(docs.length)await Item.createDocuments(docs,{pack:pack.collection});ui.notifications.info(`Spell reference: ${docs.length} entries imported to ${pack.metadata.label}.`);
}
Hooks.once("init",()=>{game.settings.register(ID,"autoDamage",{name:"Automatically subtract persistent damage from HP",hint:"GM only. If disabled, rolls appear in chat but HP is not changed.",scope:"world",config:true,type:Boolean,default:true});game.settings.register(ID,"combatTick",{name:"Resolve persistent damage at combat turn start",hint:"Uses GM combat turn updates. Keep only one GM actively processing combat turns.",scope:"world",config:true,type:Boolean,default:true});});
Hooks.once("ready",()=>{game.persistentAfflictions={apply,step,tick,overflow,showActor,configureItem,importCatalog,types:TYPES};
 if(owned()){ui.notifications.info("Persistent Afflictions ready. Select a token and use game.persistentAfflictions.showActor(canvas.tokens.controlled[0].actor) or the macro below.");}
});
let lastTurn="";
Hooks.on("updateCombat",async(combat,changed)=>{if(!owned()||!game.settings.get(ID,"combatTick"))return;if(!("turn" in changed)&&!("round" in changed))return;const key=`${combat.id}:${combat.round}:${combat.turn}`;if(lastTurn===key)return;lastTurn=key;const actor=combat.combatant?.actor;if(actor)try{await tick(actor);}catch(e){console.error(ID,e);ui.notifications.error(`Persistent Afflictions: ${e.message}`);}});
Hooks.on("renderItemSheet",(app,html)=>{if(!owned()||!app.item||!(["weapon","spell"].includes(app.item.type)))return;const root=html instanceof HTMLElement?html:html?.[0];if(!root)return;const b=document.createElement("button");b.type="button";b.className="pa-item-button";b.textContent="Persistent Affliction Settings";b.addEventListener("click",()=>configureItem(app.item));root.querySelector(".window-content")?.prepend(b);});
Hooks.on("getSceneControlButtons",controls=>{if(!owned())return;const tokens=Array.isArray(controls)?controls.find(x=>x.name==="tokens"):controls.tokens;if(!tokens)return;const tool={name:"persistent-afflictions",title:"Persistent Afflictions",icon:"fas fa-droplet",button:true,onClick:openPanel};if(Array.isArray(tokens.tools))tokens.tools.push(tool);else tokens.tools[tool.name]=tool;});
