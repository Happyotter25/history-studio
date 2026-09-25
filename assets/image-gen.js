/* AI 이미지 — 사진·그림풍 장면 그림을 이미지 생성 서비스로 만듭니다 (Claude 는 이미지를 만들지 않으므로 다른 회사의 키를 씁니다).
 *  - OpenAI 이미지 API (/v1/images/generations)
 *  - Google Gemini 이미지 (generateContent, 응답 형식 IMAGE)
 * 키는 이 브라우저의 localStorage(hs.imgKey)에만 두고 백업에는 넣지 않습니다. 모델 이름은 설정에서 바꿀 수 있습니다.
 */
(function(){
  'use strict';
  var HS = window.HS;
  var PROVIDERS = {
    openai: { name: 'OpenAI', model: 'gpt-image-1', won: 90 },
    gemini: { name: 'Google Gemini', model: 'gemini-2.5-flash-image', won: 60 }
  };
  HS.IMAGE_PROVIDERS = PROVIDERS;
  HS.IMG = { provider: HS.load('hs.imgProvider', ''), key: HS.load('hs.imgKey', ''), model: HS.load('hs.imgModel', '') };
  HS.imageOn = function(){ return !!(PROVIDERS[HS.IMG.provider] && HS.IMG.key); };
  HS.imageProviderName = function(){ var p = PROVIDERS[HS.IMG.provider]; return p ? p.name : ''; };
  HS.imageCostWon = function(){ var p = PROVIDERS[HS.IMG.provider]; return p ? p.won : 0; };
  HS.saveImageSettings = function(provider, key, model){
    HS.IMG.provider = provider; HS.IMG.key = key; HS.IMG.model = model;
    HS.save('hs.imgProvider', provider); HS.save('hs.imgKey', key); HS.save('hs.imgModel', model);
  };

  var STYLE = 'Educational illustration for a Korean history YouTube video. Historically accurate costume, armor, architecture and ships for the period. ' +
    'Painterly, cinematic lighting, rich but natural colors. Absolutely no text, letters, captions, signatures or watermarks in the image.';

  function fail(status, msg){
    var e = new Error(status === 401 || status === 403 ? '이미지 서비스 키가 맞지 않거나 권한이 없습니다'
      : status === 429 ? '이미지 요청이 너무 잦거나 사용 한도를 넘었습니다. 잠시 뒤 다시 해 보세요'
      : status === 400 && /safety|policy|moderation|blocked/i.test(msg) ? '이미지 규칙에 걸렸습니다. 장면 설명(프롬프트)을 바꿔 보세요'
      : status >= 500 ? '이미지 서비스에 문제가 있습니다. 잠시 뒤 다시 해 보세요'
      : '이미지를 만들지 못했습니다: ' + String(msg || status).slice(0, 120));
    e.status = status; return e;
  }
  function readError(res){ return res.text().then(function(t){ var m = t; try{ var j = JSON.parse(t); m = (j.error && (j.error.message || j.error.status)) || t; }catch(x){} throw fail(res.status, m); }); }

  function openai(prompt, aspect){
    return fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + HS.IMG.key },
      body: JSON.stringify({ model: HS.IMG.model || PROVIDERS.openai.model, prompt: prompt, n: 1, size: aspect === '9:16' ? '1024x1536' : '1536x1024', quality: 'medium' })
    }).then(function(res){
      if(!res.ok) return readError(res);
      return res.json().then(function(j){
        var d = j.data && j.data[0];
        if(d && d.b64_json) return 'data:image/png;base64,' + d.b64_json;
        if(d && d.url) return d.url;
        throw fail(0, '빈 응답');
      });
    });
  }
  function gemini(prompt, aspect){
    var model = HS.IMG.model || PROVIDERS.gemini.model;
    return fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': HS.IMG.key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect === '9:16' ? '9:16' : '16:9' } }
      })
    }).then(function(res){
      if(!res.ok) return readError(res);
      return res.json().then(function(j){
        var parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
        for(var i = 0; i < parts.length; i++){
          var d = parts[i].inlineData || parts[i].inline_data;
          if(d && d.data) return 'data:' + (d.mimeType || d.mime_type || 'image/png') + ';base64,' + d.data;
        }
        var why = ((j.candidates || [])[0] || {}).finishReason || (j.promptFeedback && j.promptFeedback.blockReason);
        throw fail(400, why ? 'blocked: ' + why : '이미지가 오지 않았습니다');
      });
    });
  }
  HS.generateImage = function(prompt, aspect){
    if(!HS.imageOn()) return Promise.reject(new Error('설정에서 이미지 서비스와 키를 넣어 주세요'));
    return (HS.IMG.provider === 'gemini' ? gemini : openai)(prompt, aspect);
  };

  // 장면 하나의 그림을 만듭니다: 대본의 영어 프롬프트(없으면 화면 설명)에 화풍 안내를 붙입니다
  HS.scenePrompt = function(s){
    var p = HS.project, base = s.prompt || s.visual || s.heading;
    // 🎨 이미지 탭의 화풍·등장인물 설정을 함께 씁니다
    if(HS.shotPrompt) return HS.shotPrompt({ prompt: base + '\nContext: ' + (p.title || '') + ' — ' + s.heading + '. Mood: ' + (s.mood || 'day') + '.', desc: s.visual || '' });
    return base + '\n\nContext: ' + (p.title || '') + ' — ' + s.heading + '. Mood: ' + (s.mood || 'day') + '.\n' + STYLE +
      (p.aspect === '9:16' ? ' Vertical 9:16 composition with the subject in the center.' : ' Wide 16:9 composition.');
  };
  HS.drawSceneImage = function(i){
    var s = HS.project.scenes[i];
    var before = s.image ? HS.snapshot('#' + (i + 1) + ' AI 이미지 다시 만들기 전') : Promise.resolve();
    return before.then(function(){ return HS.generateImage(HS.scenePrompt(s), HS.project.aspect); })
      .then(function(u){ return HS.shrinkImage(u, 1920); })
      .then(function(u){ s.image = u; s.svg = null; HS.changed('scene'); return u; });
  };
})();
