# Codex로 사관 스튜디오 고치기

OpenAI의 **Codex**에게 이 저장소를 맡겨 기능을 고치거나 더할 수 있습니다.
Codex는 저장소 맨 위의 `AGENTS.md`를 작업 안내서로 읽습니다. 그 안에 구조, 시험 방법, 지켜야 할 약속이 적혀 있습니다.

두 가지 방법이 있습니다. 컴퓨터에 설치하는 **Codex CLI**와, 웹에서 쓰는 **Codex 클라우드**입니다.

---

## 방법 1. Codex CLI (내 컴퓨터에서)

### 1) 준비물 설치 (처음 한 번)
1. **Node.js**: https://nodejs.org 에서 LTS 버전을 받아 설치합니다.
2. **Git**: https://git-scm.com 에서 받아 설치합니다.
3. **Codex CLI**: 터미널(Windows는 PowerShell, Mac은 터미널)을 열고 입력합니다.
   ```
   npm install -g @openai/codex
   ```
   - Mac은 `brew install --cask codex` 로도 설치할 수 있습니다.
   - Windows에서 잘 안 되면 WSL(리눅스 환경)에서 쓰는 것이 안정적입니다.
   - 설치 방법은 바뀔 수 있으니, 막히면 공식 안내 https://github.com/openai/codex 를 확인하세요.

### 2) 저장소 받기 (처음 한 번)
```
git clone https://github.com/Happyotter25/history-studio.git
cd history-studio
npm run setup
```
`npm run setup`은 시험에 쓰는 프로그램(Playwright, Chromium)을 설치합니다. 몇 분 걸립니다.
저장소가 비공개라면 `git clone` 때 GitHub 로그인을 물어봅니다.

### 3) Codex 실행
```
cd history-studio
codex
```
처음 실행하면 로그인 방법을 묻습니다. **Sign in with ChatGPT**를 고르면 ChatGPT 계정(Plus·Pro 등)으로 쓸 수 있습니다.
그다음 한국어로 부탁하면 됩니다.

> 예: "③ 삽화 영상 탭에 장면 복제 단추를 만들어 줘. AGENTS.md 약속대로 시험까지 돌려 줘."

Codex는 파일을 고치기 전에 허락을 묻습니다. 무엇을 바꾸는지 읽어 보고 승인하세요.

### 4) 고친 것을 GitHub에 올리기
Codex에게 "브랜치를 만들어 커밋하고 올려 줘"라고 하거나, 직접 입력합니다.
```
git checkout -b codex/장면-복제
git add -A
git commit -m "장면 복제 단추"
git push -u origin codex/장면-복제
```
GitHub 저장소 페이지에서 **Compare & pull request**를 눌러 확인한 뒤 `main`에 합칩니다.

### 5) 다음에 다시 할 때
```
cd history-studio
git checkout main
git pull
codex
```
`git pull`로 최신 내용(다른 곳에서 고친 것 포함)을 먼저 받은 뒤 시작하세요.

---

## 방법 2. Codex 클라우드 (웹에서, 설치 없이)
1. https://chatgpt.com/codex 에 들어갑니다.
2. GitHub를 연결하고, 저장소 목록에서 **Happyotter25/history-studio**를 고릅니다.
3. 환경(Environment) 설정의 **Setup script**에 다음을 넣습니다. 시험용 브라우저를 미리 설치하는 줄입니다.
   ```
   npm install && npx playwright install --with-deps chromium
   ```
4. 할 일을 한국어로 적으면, Codex가 고치고 **PR(변경 요청)**을 만들어 줍니다. 확인한 뒤 GitHub에서 합칩니다.

---

## 이미지 만들기 (Codex 구독으로 대본에 맞는 그림 만들기)

사관 스튜디오는 브라우저에서 돌아가서 ChatGPT·Codex 구독 계정으로 직접 그림을 요청할 수는 없습니다.
그래서 **주문서 → Codex가 그림 → 스튜디오가 불러오기** 차례로 합니다.

1. 사관 스튜디오 **🎨 이미지** 탭에서 **① 이미지 기획**을 누릅니다. 장면마다 샷이 정해집니다. 프롬프트·화풍·인물 설정을 원하는 대로 고칩니다.
2. **② 이미지 주문서 받기**를 눌러 ZIP을 받고 압축을 풉니다. 안에 `prompts.json`, `CODEX_PROMPT.txt`, 빈 `images` 폴더가 있습니다.
3. 그 폴더에서 터미널을 열고 Codex를 실행합니다.
   ```
   cd "이미지 주문서"
   codex
   ```
4. `CODEX_PROMPT.txt`의 내용을 Codex에 붙여 넣습니다. Codex가 그림을 하나씩 만들어 `images` 폴더에 파일 이름대로 저장합니다.
   - Codex에서 그림 생성을 쓸 수 있는지는 **요금제와 Codex 버전**에 따라 다릅니다. "이미지 생성 도구가 없다"고 하면
     ChatGPT 앱에서 `prompts.json`의 프롬프트를 하나씩 붙여 넣어 만들고, 받은 그림을 파일 이름대로 저장하세요.
   - 그림이 많으면 몇 번에 나눠 부탁하세요 (예: "S01부터 S05까지 먼저").
5. 스튜디오의 **③ 만든 이미지 불러오기**(또는 폴더째 불러오기)로 `images` 폴더의 그림을 한꺼번에 고릅니다. 파일 이름으로 샷을 찾아 자동으로 붙습니다.
6. 남은 그림이 있으면 주문서를 다시 받으면 **아직 없는 그림**과 **다시 그리기로 표시한 그림**만 들어 있습니다.
7. 마음에 안 드는 그림은 샷의 **🔁 다시 그리기 → 고칠 점 적기 → 다음 주문서에 넣기**를 한 뒤 **다시 그릴 것 주문서**를 받아 Codex에 다시 맡기면 됩니다.
   새 그림을 불러오면 전 그림은 후보로 남아 되돌릴 수 있습니다. 특정 샷만 맡기려면 체크해서 **고른 것만 주문서**를 받으세요.

> 파일 이름 규칙: `S03-2_ab12.png` = 3번 장면의 2번째 샷(뒤의 네 글자는 샷 번호표). 이름만 맞으면 어떤 도구로 만든 그림이든 붙습니다.

## Claude Code와 함께 쓸 때
Claude Code는 `CLAUDE.md`를 읽는데, 이 파일은 `AGENTS.md`를 가리킵니다. 그래서 두 도구가 같은 안내를 따릅니다.
두 도구로 같은 부분을 동시에 고치면 충돌할 수 있으니, 한쪽 작업을 `main`에 합친 다음 다른 쪽을 시작하세요.

## 자주 막히는 곳
| 증상 | 해결 |
|---|---|
| `codex: command not found` | 터미널을 닫았다 다시 열거나, `npm install -g @openai/codex`를 다시 실행 |
| `git clone`에서 권한 오류 | GitHub에 로그인했는지 확인 (비공개 저장소일 때) |
| 시험(`npm test`)이 브라우저를 못 찾음 | `npx playwright install chromium` 실행 |
| Codex가 "인터넷이 막혀 설치할 수 없다" | 설치는 직접 `npm run setup`으로 해 두고, Codex에게는 `npm run check`와 `npm test`만 돌리게 하기 |
