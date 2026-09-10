# 실내 Cycles / Godot 비교

천장·창문·소파·테이블·책장이 있는 동일한 실내를 양쪽 엔진에서 렌더했다. 1280×900, 수직 시야각 65°, 같은 메시·카메라·표면색·햇빛 방향을 사용한다. 외부 하늘광은 없으며, 노출 보정과 디노이즈도 적용하지 않았다. 노멀맵/사진 텍스처를 쓰지 않는 기하 기반 진단 씬이다.

## 발견과 수정

기존 Godot→Cycles 조명 변환에 π가 빠져 있었다. Godot의 LIGHT_COLOR는 에너지에 π를 곱하므로, 이 배율을 베이커의 광도 변환에도 반영했다. 근거: [Godot spatial shader Light built-ins](https://docs.godotengine.org/en/4.6/tutorials/shaders/shader_reference/spatial_shader.html#light-built-ins). 기존 저장된 베이크에는 자동 소급되지 않으므로 다시 구워야 한다.

PNG의 sRGB를 선형 RGB로 변환해 측정한 결과:

| 비교 | 수정 전 | 수정 후 |
|---|---:|---:|
| 직접광 영역의 Godot/Cycles 밝기 비 중앙값 | 3.413 | 1.089 |
| 전체 영상 선형 RGB RMSE | 0.03439 | 0.01204 |
| 간접광 평균값 Godot / Cycles | 0.002851 / 0.002848 | 0.009007 / 0.008967 |

간접광 전달 자체의 큰 밝기 흐름은 비슷했다. 수정 후 간접광 평균 차이는 약 0.45%다. **이는 전체 품질 일치율이 아니며**, 벽과 천장의 국소적인 얼룩 차이는 평균값에 드러나지 않는다. 직접광 비율은 밝기 0.002~0.8, 비율 0.1~10 범위의 겹치는 픽셀에서 측정했다. 두 엔진의 표면 반사 모델·그림자 경계 차이도 포함된다.

## 남은 품질 문제

- Cycles 베이크의 샘플 노이즈가 낮은 라이트맵 해상도에서 확대되어 큰 얼룩으로 보인다. 현재 256 samples, 0.065m 텍셀이고 디노이즈가 없다. 원본 Cycles 렌더는 512 samples의 미세한 노이즈다.
- 햇빛 하나에 하늘광이 없는 조건이어서 Cycles 원본도 그림자 영역이 어둡다. 실제 주간 실내 품질 판단에는 창문을 통한 하늘광도 필요하다.
- 직접광·그림자·반사광의 표현 차이는 남아 있다. 이번 수정은 광도 단위 차이를 줄였으며 완전한 렌더러 일치를 구현한 것은 아니다.
- 동적 캐릭터·CITY·성능은 이 비교에 포함하지 않았다. 동일 실내에 프로브 75개를 생성했지만 여기서는 정적 배경만 비교했다.

## 결과물과 재현

- [대화형 비교](compare.html): Cycles 원본, GI 켜기 전후, 간접광, 광도 수정 전후.
- Godot 씬 `baked.tscn` 과 Blender 원본 `interior_reference.blend` 은 프로젝트 저장소에만 있고 이 공개본에는 포함하지 않았다.
- Blender에서 재열어 Cycles·카메라 유지와 누락된 외부 텍스처가 없음을 확인했다. 실제 표시 메시 67개, 2,008 vertices / 1,356 triangles. 베이크 이미지 67장을 내장했다. 사진 재현용 텍스처는 사용하지 않았다.
- `verify_interior.gd` → `render_interior.py -- interior/reference.json` → `analyze_interior.py -- interior` 순서로 생성한다. Godot 스크립트는 GPU 창, Python 스크립트는 Blender 백그라운드 실행이다.
- 광도 수정 후 기본 자동화 회귀는 23 checks / 0 failures. 기존 씬 교체 때의 엔진 경고는 상위 `VALIDATION.md`와 `demo_verify.log`에 기록되어 있다.
