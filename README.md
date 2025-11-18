# Books Read

읽은 책 목록과 GitHub contribution graph 형태의 독서 히트맵을 보여주는 사이트입니다.

`books.csv`만 수정하면 히트맵과 목록이 자동 생성됩니다.

## 사용법
- 책을 읽을 때마다 `books.csv`에 **title, english-title, year, month** 순으로 기록합니다.
  - `english-title`은 선택값입니다. 번역본 제목이 없다면 비워 두면 되고, 한글/영문 중 하나만 있어도 두 언어 모드에서 동일한 제목이 표시됩니다.
- 같은 책을 여러 번 읽었다면 각 시점을 별도로 기록합니다. 가장 최근 기록에는 `N회차` 태그가 붙습니다.
- 히트맵의 총 권수는 같은 책을 여러번 읽으면 따로 계산됩니다.
- 화면 오른쪽 상단의 버튼으로 **언어 모드(🇰🇷/🇺🇸)** 와 **다크 모드(🌙/☀️)** 를 토글할 수 있습니다.
- 파비콘은 원하는 파일을 `favicon.ico`로 교체하면 됩니다.

## GitHub Pages로 호스팅
- 이 repo를 public repo로 가져옵니다 (예: fork).
- GitHub → Settings → Pages
  - **Source:** Deploy from a branch
  - **Branch:** main
