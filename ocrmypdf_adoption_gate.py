import hashlib,json,pathlib,subprocess,shutil,sys,urllib.request,zipfile,tempfile,email,os
import base64,zlib
EXPECTED = json.loads(zlib.decompress(base64.b64decode('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')))
SOURCE = {'url':'https://files.pythonhosted.org/packages/d9/1b/d35a3c9bb4e4959bd782808f0eb45cce16e66040a292b7f4eaa6a6e44ff1/ocrmypdf-17.13.0.tar.gz','sha256':'151c35d810eb628fbc5cb9bbe80b834ecf094737efa0e7a2e9e1fac3c730ed49'}
def run(args,env=None):
 r=subprocess.run(args,env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=300)
 print(r.stdout[-6000:]);assert r.returncode==0, 'CHECK_FAILED: '+args[0]
assert subprocess.check_output(['hostname'],text=True).strip()=='ariel-shapira-Dell-Pro-Micro-Plus-QBM1250'
assert os.getuid()==1000 and subprocess.check_output(['id','-un'],text=True).strip()=='ariel-shapira'
assert '192.168.1.172/' in subprocess.check_output(['ip','-4','-o','addr','show'],text=True)
required=['trivy','semgrep','gitleaks','unshare']
missing=[x for x in required if not shutil.which(x)]
assert not missing, 'GATE_BLOCKED_MISSING_EXISTING_TOOLS: '+','.join(missing)
assert not os.environ.get('SUPABASE_SERVICE_ROLE_KEY'), 'PRODUCTION_CREDENTIAL_PRESENT'
env={'PATH':os.environ['PATH'],'HOME':os.environ['HOME'],'SEMGREP_SEND_METRICS':'off','SEMGREP_ENABLE_VERSION_CHECK':'0','PIP_DISABLE_PIP_VERSION_CHECK':'1'}
run(['unshare','--user','--map-root-user','--net','true'],env)
with tempfile.TemporaryDirectory(prefix='ocrmypdf-adoption-') as root:
 root=pathlib.Path(root);w=root/'wheels';w.mkdir();unpacked=root/'unpacked';unpacked.mkdir()
 for r in EXPECTED:
  b=urllib.request.urlopen(r['artifact_url'],timeout=30).read();assert hashlib.sha256(b).hexdigest()==r['sha256'], 'HASH_MISMATCH'
  p=w/r['filename'];p.write_bytes(b)
  with zipfile.ZipFile(p) as z:
   for n in z.namelist():assert not n.startswith('/') and '..' not in pathlib.PurePosixPath(n).parts, 'UNSAFE_WHEEL_PATH'
   m=email.message_from_bytes(z.read(next(n for n in z.namelist() if n.endswith('.dist-info/METADATA'))));assert m['Name'].lower().replace('_','-')==r['name'].lower().replace('_','-');assert m['Version']==r['version'];assert m.get('License-Expression') or m.get('License') or any('License ::' in c for c in m.get_all('Classifier',[])), 'LICENSE_UNKNOWN'
   z.extractall(unpacked)
  q=urllib.request.Request('https://api.osv.dev/v1/query',data=json.dumps({'package':{'name':r['name'],'ecosystem':'PyPI'},'version':r['version']}).encode(),headers={'Content-Type':'application/json'})
  v=json.load(urllib.request.urlopen(q,timeout=30));assert not v.get('vulns'), 'KNOWN_VULNERABILITY: '+r['name'];print('HASH_LICENSE_OSV_PASS',r['name'],r['version'])
  if r['name'].lower()=='ocrmypdf':assert m['License-Expression']=='MPL-2.0'
 (root/'requirements.txt').write_text('\n'.join(r['name']+'=='+r['version'] for r in EXPECTED)+'\n')
 # Scanner rules are local and telemetry is disabled. Any scanner error fails.
 rules=root/'rules.yml';rules.write_text('''rules:
- id: unexpected-outbound-client
  languages: [python]
  severity: ERROR
  message: Outbound client requires manual review before adoption
  pattern-either:
  - pattern: requests.$F(...)
  - pattern: httpx.$F(...)
  - pattern: urllib.request.urlopen(...)
  - pattern: socket.socket(...)
- id: telemetry-client
  languages: [python]
  severity: ERROR
  message: Telemetry client requires manual review
  pattern-either:
  - pattern: sentry_sdk.$F(...)
  - pattern: posthog.$F(...)
  - pattern: segment.$F(...)
''')
 run(['semgrep','scan','--metrics=off','--disable-version-check','--error','--config',str(rules),str(unpacked)],env)
 run(['gitleaks','dir','--no-banner','--redact=100','--exit-code','1',str(unpacked)],env)
 run(['trivy','fs','--scanners','vuln,secret','--severity','HIGH,CRITICAL','--exit-code','1',str(root)],env)
 # Binary dependencies need affirmative provenance and binary-review evidence,
 # not a text grep. Until a reviewed binary dossier exists, fail closed.
 binaries=list(unpacked.rglob('*.so'))+list(unpacked.rglob('*.pyd'))
 assert not binaries, 'GATE_BLOCKED_BINARY_DOSSIER_MISSING: '+str(len(binaries))
 print('OCRMY_PDF_ADOPTION_GATE_PASS version17.13.0')
