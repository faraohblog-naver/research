# 쿠팡 상품 검색 기능 — 배포 안내

`index.html`의 "쿠팡 상품 검색" 탭은 쿠팡 파트너스(제휴 마케팅) 오픈API의 상품검색을 호출해서
상품명·가격·이미지·로켓배송 여부·쿠팡 링크를 보여줍니다.

> **먼저 알아두세요 — 이 기능으로 안 되는 것**
> 쿠팡 파트너스 오픈API는 **리뷰 개수·평점·판매횟수를 제공하지 않습니다.** 쿠팡이 제휴사에게도
> 공개하지 않는 데이터라, API 키를 발급받아도 이 값들은 가져올 수 없습니다. 상품 상세페이지에만
> 표시되는 정보라 API로는 접근 불가능합니다. 나중에 이 정보가 꼭 필요해지면 상품 URL을 붙여넣어
> 페이지를 직접 읽어오는 방식(스크래핑)으로 전환해야 하는데, 개발 부담도 있고 쿠팡 이용약관상
> 자동 수집이 금지되어 있어 권장하지 않습니다.
>
> 또한 상품검색 API는 **1시간에 최대 10번**만 호출할 수 있는 엄격한 제한이 있습니다. 검색 버튼을
> 여러 번 연달아 누르면 금방 막히니 아껴서 사용하세요.

## 1. 쿠팡 파트너스 API 키 발급

1. [partners.coupang.com](https://partners.coupang.com)에서 쿠팡 계정으로 가입 (심사에 며칠 걸릴 수 있음)
2. 가입 승인 후 로그인 → 우측 상단 계정 메뉴 → **API 정보** 또는 **마이페이지 > 오픈API 이용**으로 이동
3. 아래 두 가지 값을 확인/저장:
   - **ACCESS KEY** → `COUPANG_ACCESS_KEY`
   - **SECRET KEY** → `COUPANG_SECRET_KEY` (발급 시 한 번만 보여줄 수 있으니 꼭 복사해두세요)
4. 무료입니다. 다만 위에서 설명한 대로 호출 제한(1시간 10회)이 있습니다.

## 2. Edge Function 배포

이미 Supabase 프로젝트(`mguhphgvzwftzzwmuklg`)를 이 도구용으로 쓰기로 했습니다. 로컬 PC 터미널에서:

```bash
npm install -g supabase        # 최초 1회, 이미 설치했다면 생략
supabase login
supabase link --project-ref mguhphgvzwftzzwmuklg

supabase secrets set COUPANG_ACCESS_KEY=발급받은값 COUPANG_SECRET_KEY=발급받은값
supabase functions deploy coupang-search
```

배포가 끝나면 함수 URL은 다음과 같고, `index.html` 안에 이미 이 주소로 연결해뒀습니다 (수정 불필요):

```
https://mguhphgvzwftzzwmuklg.supabase.co/functions/v1/coupang-search?keyword=무선청소기
```

## 3. 확인

사이트에서 "쿠팡 상품 검색" 탭 → 검색어 입력 → 검색. 키 설정이 안 됐거나 틀리면 화면에 에러
메시지가 그대로 뜹니다 (예: `COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY가 설정되지 않았습니다`).
