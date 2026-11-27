# make_elevation.py
# 공개 고도 자료(10분 간격)를 1도 간격 격자로 줄여서 elevation.js 로 저장한다.
#
# 원자료 : Earth topography grid at 10 arc-minute resolution (Fatiando a Terra, CC-BY 4.0)
#          https://github.com/fatiando-data/earth-topography-10arcmin
#          NOAA ETOPO1 (ice surface) 을 10분 간격 격자로 정리한 자료
# 받는 법 : curl -L -O https://github.com/fatiando-data/earth-topography-10arcmin/releases/download/v1/earth-topography-10arcmin.nc
# 실행    : python make_elevation.py earth-topography-10arcmin.nc ../elevation.js

import sys
import numpy as np
from netCDF4 import Dataset

SRC_PER_DEG = 6    # 원자료는 1도에 6칸 (10분 간격)
HALF = 3           # 격자점 주변 ±0.5도 = ±3칸
ROWS = 181         # 위도 90N ~ 90S, 1도 간격
COLS = 360         # 경도 180W ~ 179E, 1도 간격

src_path = sys.argv[1] if len(sys.argv) > 1 else "earth-topography-10arcmin.nc"
out_path = sys.argv[2] if len(sys.argv) > 2 else "elevation.js"

# 원자료 읽기: topography[위도][경도], 단위 m, 위도는 남→북, 경도는 서→동
ds = Dataset(src_path)
topo = np.array(ds.variables["topography"][:], dtype=np.float64)
ds.close()
print("원자료 크기:", topo.shape, " 최저:", topo.min(), " 최고:", topo.max())

topo = topo[::-1, :]     # 북→남 순서로 뒤집기 (0행 = 북위 90도)
topo = topo[:, :-1]      # 경도 +180도 열은 -180도 열과 같은 지점이라 제거 (2160열)

# 1도 격자점마다 주변 ±0.5도 범위(7x7개)의 평균을 그 점의 고도로 쓴다.
# 한 점만 뽑으면(점 표본) 좁은 산맥이나 해구가 격자 사이로 빠질 수 있어서 평균을 썼다.
grid = np.zeros((ROWS, COLS), dtype=np.int32)
for r in range(ROWS):                               # 위도 = 90 - r
    i0 = r * SRC_PER_DEG
    i_lo = max(i0 - HALF, 0)
    i_hi = min(i0 + HALF, topo.shape[0] - 1)
    for c in range(COLS):                           # 경도 = -180 + c
        j0 = c * SRC_PER_DEG
        js = np.arange(j0 - HALF, j0 + HALF + 1) % topo.shape[1]   # 경도는 한 바퀴 돌아 이어진다
        window = topo[i_lo:i_hi + 1][:, js]
        grid[r, c] = int(round(window.mean()))

# 극점은 경도와 상관없이 한 점이므로 값을 하나로 통일한다.
grid[0, :] = int(round(grid[0, :].mean()))
grid[-1, :] = int(round(grid[-1, :].mean()))
print("1도 격자 크기:", grid.shape, " 최저:", grid.min(), " 최고:", grid.max())

# JavaScript 배열로 저장 (한 줄 = 위도 하나)
with open(out_path, "w", encoding="utf-8") as f:
    f.write("// elevation.js : 전 지구 고도 자료 (1도 격자, 단위 m, 해수면 기준)\n")
    f.write("// tools/make_elevation.py 로 생성한 파일. 직접 고치지 말 것.\n")
    f.write("// 원자료: Earth topography grid at 10 arc-minute resolution\n")
    f.write("//         (Fatiando a Terra, CC-BY 4.0, doi:10.5281/zenodo.5882203)\n")
    f.write("//         NOAA ETOPO1 ice surface (doi:10.7289/V5C8276M) 기반\n")
    f.write("// 배열 순서: elevationData[ 행 * ELEV_COLS + 열 ]\n")
    f.write("//   행 0 = 북위 90도, 행 180 = 남위 90도\n")
    f.write("//   열 0 = 서경 180도, 열 359 = 동경 179도\n\n")
    f.write("var ELEV_ROWS = %d;\n" % ROWS)
    f.write("var ELEV_COLS = %d;\n\n" % COLS)
    f.write("var elevationData = [\n")
    for r in range(ROWS):
        f.write(",".join(str(v) for v in grid[r]))
        f.write(",\n" if r < ROWS - 1 else "\n")
    f.write("];\n")

print("저장 완료:", out_path)
