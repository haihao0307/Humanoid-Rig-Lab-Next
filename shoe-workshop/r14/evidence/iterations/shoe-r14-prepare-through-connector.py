import argparse, hashlib, importlib.util, json, pathlib, time

helper = pathlib.Path('/tmp/shoe-r14-prepare-publisher.py')
assert hashlib.sha256(helper.read_bytes()).hexdigest() == '67803744e6a6d3769e2410f513aeb83c8be75dcf1faaef825f7ae540e9fae491'
bridge = pathlib.Path('/tmp/shoe-r14-live-github-bridge-v2')
bridge.mkdir(exist_ok=True)
spec = importlib.util.spec_from_file_location('r14_verified_preparation', helper)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
requests = []

def live_connector_api(suffix):
    number = len(requests) + 1
    response = bridge / ('response-' + str(number) + '.json')
    assert not response.exists(), 'Bridge directory must be fresh'
    request = {'id': number, 'suffix': suffix, 'responsePath': str(response)}
    requests.append(request)
    print('R14_GITHUB_REQUEST ' + json.dumps(request), flush=True)
    deadline = time.monotonic() + 180
    while not response.exists():
        if time.monotonic() > deadline: raise SystemExit('Live GitHub connector response timed out')
        time.sleep(.1)
    result = json.loads(response.read_bytes())
    assert result['id'] == number and result['suffix'] == suffix
    assert result['provider'] == 'CONNECTED_GITHUB_APP_LIVE_GET'
    if 'error' in result: raise SystemExit('Live GitHub connector: ' + result['error'])
    return result['data']

# Replace only the read transport. All original identity, byte, source,
# independent-review and still-locked-output validators execute unchanged.
module.api = live_connector_api
args = argparse.Namespace(run_id='39108047375', artifact_id='12129576334',
    artifact_zip='/tmp/shoe-r14-candidate-39108047375.zip',
    review='/workspace/scratch/e3aba5d62e5a/shoe-project/shoe-workshop/r14/VISUAL_REVIEW.json',
    template='/tmp/shoe-r14-publish.template.yml', output='/tmp/shoe-r14-publish.locked.yml')
module.prepare(args)
receipt = {'status':'PREPARED_WITH_UNCHANGED_VALIDATORS_THROUGH_CONNECTED_GITHUB_APP',
    'helperSha256':hashlib.sha256(helper.read_bytes()).hexdigest(),
    'requestCount':len(requests), 'requests':requests,
    'reason':'Anonymous GitHub REST reads returned HTTP 403. Each replacement read was made live by the already connected GitHub App; no local source or report was substituted for the API response. The connector returns Git blobs as decoded UTF-8 source; the broker only re-encodes those exact bytes to the REST base64 shape, and the unchanged helper recomputes Git blob SHA and byte length.',
    'promotionReady':False,'publisherExecuted':False}
(bridge/'TRANSPORT_RECEIPT.json').write_text(json.dumps(receipt,indent=2)+'\n')
print('R14_CONNECTOR_PREPARATION_COMPLETE', flush=True)
