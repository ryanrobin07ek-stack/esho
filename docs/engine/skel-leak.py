import json,glob,os,re
cat={}
for f in glob.glob('/home/claude/catalogs/*.catalog.json'):
    d=json.load(open(f)); cat[os.path.basename(f).replace('.catalog.json','')]=[p['name'] for p in d.get('products',[]) if p.get('name') and len(p['name'])>6]
PFX={'aura-luxe':'aura-luxe','elura-botanicals':'elura','atelier-vera':'atelier-vera','autopro-kenya':'autopro','etalon':'etalon','kicks-vault':'kicks-vault','kifaru-build':'kifaru','kinetic-electronics':'kinetic','maison-alchemie':'maison-alchemie','veluna':'veluna','woodora':'woodora','volthaus':'volthaus','aurex-electronics':'aurex','shamba-bora':'shamba','olkeri-expeditions':'olkeri','nairobi-feast':'nairobi','aurus-real-estate':'aurus','elysian-stays':'elysian','arcadia-events':'arcadia','mikaa-woodfire-coast':'mikaa'}
dirs=os.listdir('/home/claude/demoeo')
phone=re.compile(r'(\+?254[\s\-]?\d[\d\s\-]{7,}|\b0[17]\d{2}[\s\-]?\d{3}[\s\-]?\d{3}\b)')
mail=re.compile(r'[\w.\-]+@[\w\-]+\.[a-z]{2,}',re.I)
print(f"{'theme':<24}{'demo names left':<17}{'phones':<8}{'emails':<8}{'unsplash/ext img':<17}jsonld")
for dd in sorted(dirs):
    h=open(f'/home/claude/demoeo/{dd}/index.html',encoding='utf-8',errors='replace').read()
    key=next((k for k,p in PFX.items() if dd.startswith(p)),None)
    names=cat.get(key,[]) if key else []
    left=[n for n in names if n in h]
    imgs=len(re.findall(r'https?://(?:images\.unsplash|plus\.unsplash|picsum|source\.unsplash|images\.pexels|cdn\.)[^\s"\')]+',h))
    ld=len(re.findall(r'application/ld\+json',h))
    print(f"{dd[:23]:<24}{(str(len(left))+'/'+str(len(names))) if key else 'n/a':<17}{len(set(phone.findall(h))):<8}{len(set(mail.findall(h))):<8}{imgs:<17}{ld}")
