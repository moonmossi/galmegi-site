# Metro 불투명 재질 GI

조명 전달 수정 후 실제 Metro 베이크·적용 224.960초. 동일 0.2m·256샘플에서 하층 화면의 평균 RGB 증가량은 약 1.94 → 11.22 (약 5.8배), 대합실은 약 1.21 → 2.70이었다. 이 값은 톤 매핑 후 PNG의 0~255 화면 밝기이며 물리 광량 비율이 아니다. `brightness_comparison.json`에 원시 평균값을 보존했다. 자동 노출·GI 임의 배율은 추가하지 않았다.

조명 전달 진단: 태양광 실내 샘플과 달리 Metro는 점·스폿 광원 21개를 사용하며 모두 거리 감쇠 지수가 1이다. 이전 입력은 감쇠와 범위를 누락해 Cycles의 역제곱 감쇠로 구웠다. 이제 `distance^-attenuation * max(1-(distance/range)^4,0)^2`를 광원 노드로 재현한다. 고정 5m·범위 10m 검증에서 이전 대비 광량은 기대 4.39453배, 실제 4.39462배였다. 근거: [Godot OmniLight3D](https://docs.godotengine.org/en/stable/classes/class_omnilight3d.html).

발광 표면의 첫 조명 성분도 Cycles에서는 DIRECT여서 기존 INDIRECT 전용 경로에서 빠졌다. 명시적 라이트를 끄고 환경·발광 표면의 DIRECT만 별도로 더하도록 수정했다. 발광판 하나·라이트 0개의 실제 베이크 회귀가 통과했다. 하층 통로의 발광만 렌더는 거의 검으므로, 이 시점의 주요 원인은 발광보다 거리 감쇠다.

진단 자료: `cycles_full.png`, `cycles_emission_only.png`는 수정 전 베이크 씬의 Cycles 자체 렌더이며 낮은 해상도 UV2 표면색을 사용한다. 원본 게임 텍스처의 전체 디테일을 재현한 렌더는 아니다. `before_fix_after_*.png`는 조명 변환 수정 전 Godot 결과다. 회귀 수치: `falloff_test.json`, `emission_test.json`.

화질 우선 비교. 투명·커스텀 ShaderMaterial이 포함된 메시 18개는 베이크와 화면 양쪽에서 제외한다. 원본 Metro 레벨은 수정하지 않는다.

2026-09-10 조명 변환 수정 전 GPU 실행: 불투명 메시 67개, 라이트맵 2,796,300픽셀, 256샘플, 베이크·적용 124.902초. 이전 근사 결과의 625,980픽셀·32샘플보다 밀도를 높이고 실제 재질을 추출했다. 저장된 baked.tscn 재열기 렌더는 reopened_1.png·reopened_2.png로 확인한다. 재현 명령은 `--script res://addons/scene_lighting/custom_gi/verify_metro_quality.gd`, 재열기는 뒤에 `-- reopen`을 붙인다.

`verify_metro_quality.gd` → `quality_baker.gd` → `cycles_bake.py`. 0.2m 텍셀, 256샘플, HDR 디노이즈. 일반 StandardMaterial3D의 표면색·거칠기·금속성·발광을 Godot `bake_render_uv2`로 추출해 Cycles에 전달한다. 삼면 투영 및 버텍스 색상을 단순한 UV1 텍스처로 대체하던 이전 근사 경로를 쓰지 않는다. 월드 삼면 투영 표면은 렌더용 메시를 월드 좌표로 변환해서 추출한다.

화면은 원본 불투명 재질에 GI 추가 패스를 적용한다. 비교 카메라와 직접광은 유지하며, 이번 검증의 우선순위는 화면이다. 이동 캐릭터·투명 재질은 범위 밖이다. 노멀 맵 및 시점 의존 굴절·패럴랙스까지 Cycles에서 재현하는 범용 재질 변환기는 아니다.

API 및 채널 순서 근거: [Godot RenderingServer](https://docs.godotengine.org/en/stable/classes/class_renderingserver.html#class-renderingserver-method-bake-render-uv2), [Godot renderer implementation](https://github.com/godotengine/godot/blob/4.5/servers/rendering/renderer_rd/renderer_scene_render_rd.cpp).
