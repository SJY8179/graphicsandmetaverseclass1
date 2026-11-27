# 과제 2 - 고도 자료로 지형을 표현한 3D 지구

위도·경도 1도 격자로 구를 만들고, 공개 고도 자료를 정점마다 읽어 지형을 표현한 WebGL 프로그램입니다.

## 실행
- VS Code Live Server로 `homework2/index.html` 실행
- 또는 https://sjy8179.github.io/graphicsandmetaverseclass1/homework2/

## 기능
- 고도 과장 배율 조절 (0 ~ 100배)
- 바닷물을 빼고 해저 지형 보기
- 23.5도 기운 자전축을 중심으로 자전 (시작/정지, 속도 조절)
- 태양 방향 조절, 자동 이동

## 파일
| 파일 | 내용 |
|---|---|
| `index.html` | 정점/단편 shader, 화면 구성 |
| `earth.js` | 격자 생성, 고도별 색, 지형 변위, 법선 계산, 자전, 조명 |
| `elevation.js` | 1도 격자 고도 자료 (`tools/make_elevation.py`로 생성) |
| `tools/make_elevation.py` | 10분 간격 원자료를 1도 격자로 줄이는 스크립트 |
| `Common/` | 교재(Angel & Shreiner) 제공 유틸리티 |

## 고도 자료
- Earth topography grid at 10 arc-minute resolution, Fatiando a Terra (CC-BY 4.0), https://doi.org/10.5281/zenodo.5882203
- 원자료: NOAA ETOPO1 1 Arc-Minute Global Relief Model (ice surface), https://doi.org/10.7289/V5C8276M

`elevation.js`를 다시 만들려면:

```bash
cd tools
curl -L -O https://github.com/fatiando-data/earth-topography-10arcmin/releases/download/v1/earth-topography-10arcmin.nc
pip install numpy netCDF4
python make_elevation.py earth-topography-10arcmin.nc ../elevation.js
```
