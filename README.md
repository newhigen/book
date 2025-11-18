# Books Site Generator

독서 기록만 `books.csv`에 작성하면 자동으로 리스트와 GitHub-style 히트맵을 만들어 주는 정적 사이트 템플릿입니다.
언어(🇰🇷/🇺🇸)와 다크 모드(🌙/☀️) 토글을 제공하며, 같은 책을 여러 번 읽으면 최신 기록에 `N회차` 배지가 표시됩니다.

## 시작하기

1. **템플릿 복사**
   - 이 저장소를 템플릿으로 사용하거나 fork 합니다.
   - 기본으로 제공되는 데이터는 `books.csv.example`에 있으며, 개인 기록을 시작하려면 이 파일을 복사해 `books.csv`를 만든 뒤 편집하세요.
2. **데이터 입력 규칙**
   - CSV 컬럼 순서는 `title, english-title, year, month` 입니다.
   - `english-title`은 선택값입니다. 비워두면 `title`이 두 언어 모드에서 그대로 표시됩니다.
   - 재독 시에는 같은 책을 여러 행으로 기록합니다. 가장 최근 행에만 `N회차` 뱃지가 표시됩니다.
3. **아이콘 커스터마이즈**
   - `favicon.ico`를 원하는 아이콘으로 교체하면 탭 아이콘이 변경됩니다 (fork한 저장소에서만 수정).

## GitHub Pages 배포

1. 저장소를 public으로 만든 뒤 GitHub → **Settings → Pages** 로 이동합니다.
2. **Source**를 “Deploy from a branch”, **Branch**를 `main`으로 설정하면 자동으로 정적 사이트가 배포됩니다.

이후 개인 fork에서 `books.csv`와 `favicon.ico`만 유지한 채 upstream 업데이트를 쉽게 받아 새로운 스타일이나 기능을 적용할 수 있습니다.
