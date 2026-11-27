"use strict";

// ---------------------------------------------------------------------------
//  과제 2 : 고도 자료로 지형을 표현한 3D 지구
//
//  - elevation.js 의 고도 배열(1도 격자)을 읽어 구의 정점을 반지름 방향으로 밀어낸다.
//  - 격자 정점은 한 번씩만 만들고, 인덱스 버퍼(drawElements)로 삼각형을 구성한다.
//  - 모델 변환으로 자전을, 수정 Phong 모델로 태양빛을 표현한다.
// ---------------------------------------------------------------------------

var canvas;
var gl;

// ----- 격자 -----
var STEP = 1;                 // 격자 간격(도). 180의 약수인 정수만 가능 (고도 자료가 1도 간격)
var ROWS = 180 / STEP + 1;    // 위도선 개수: 북위 90도(0행) ~ 남위 90도
var COLS = 360 / STEP;        // 경도선 개수: 서경 180도(0열) ~ 동경 179도

var EARTH_RADIUS = 6371000;   // 지구 평균 반지름(m). 고도를 반지름 1인 구의 단위로 바꿀 때 쓴다
var AXIS_TILT = 23.5;         // 자전축 기울기(도)

// ----- 정점 데이터 -----
var points = [];    // 위치 (vec4)
var normals = [];   // 법선 (vec4, w = 0)
var colors = [];    // 색 (vec4, a = 반사광 세기)
var indices = [];   // 삼각형을 이루는 정점 번호

var positionBuffer;
var normalBuffer;
var colorBuffer;

// ----- 변환 행렬 -----
var viewMatrix;
var modelViewMatrixLoc;
var lightPositionLoc;

// ----- 화면에서 바꿀 수 있는 값 -----
var exaggeration = 30;      // 고도 과장 배율
var showSeafloor = false;   // true면 바닷물을 빼고 해저 지형까지 표현
var spinning = true;        // 자전 여부
var spinSpeed = 0.3;        // 한 프레임에 도는 각(도)
var spinAngle = -127;       // 자전 각. 처음에 동경 127도(한반도)가 정면에 오게 한다
var sunAngle = 50;          // 태양 방향(도). 0이면 카메라 쪽, 90이면 화면 오른쪽
var sunMoving = false;      // 태양 자동 이동 여부

// ----- 광원 (08강의 조명 속성과 같은 형태) -----
var lightAmbient  = vec4( 0.2, 0.2, 0.2, 1.0 );
var lightDiffuse  = vec4( 0.9, 0.9, 0.9, 1.0 );
var lightSpecular = vec4( 0.8, 0.8, 0.7, 1.0 );
var shininess = 60.0;

// ----- 고도별 색 (고도 m, 색) -----
var LAND_COLORS = [
    [    0, vec3( 0.24, 0.47, 0.22 ) ],   // 평야: 녹색
    [  500, vec3( 0.52, 0.62, 0.30 ) ],   // 구릉: 연두
    [ 1500, vec3( 0.76, 0.68, 0.42 ) ],   // 고원: 황토색
    [ 3000, vec3( 0.55, 0.40, 0.28 ) ],   // 산지: 갈색
    [ 5000, vec3( 0.85, 0.82, 0.78 ) ]    // 고산: 밝은 회색
];
var SEA_COLORS = [
    [ -8000, vec3( 0.02, 0.05, 0.22 ) ],  // 해구
    [ -4000, vec3( 0.05, 0.18, 0.45 ) ],  // 심해
    [  -200, vec3( 0.15, 0.42, 0.70 ) ],  // 대륙붕 끝
    [     0, vec3( 0.35, 0.65, 0.85 ) ]   // 얕은 바다
];
var SNOW_COLOR = vec3( 0.95, 0.96, 0.98 );


window.onload = function init()
{
    canvas = document.getElementById( "gl-canvas" );

    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 0.0, 0.0, 0.0, 1.0 );
    gl.enable( gl.DEPTH_TEST );   // 구의 뒷면이 앞면 위에 그려지지 않도록 깊이 검사를 켠다

    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    // 버퍼는 한 번만 만들고, 내용은 buildEarth()에서 채운다
    positionBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, positionBuffer );
    var vPosition = gl.getAttribLocation( program, "vPosition" );
    gl.vertexAttribPointer( vPosition, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition );

    normalBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, normalBuffer );
    var vNormal = gl.getAttribLocation( program, "vNormal" );
    gl.vertexAttribPointer( vNormal, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vNormal );

    colorBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, colorBuffer );
    var vColor = gl.getAttribLocation( program, "vColor" );
    gl.vertexAttribPointer( vColor, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vColor );

    // 인덱스는 격자 모양이 바뀌지 않는 한 그대로라서 한 번만 만든다.
    // 정점이 65,160개라 8비트(0~255)로는 번호를 다 못 담아서 16비트 배열을 쓴다.
    buildIndices();
    var indexBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, indexBuffer );
    gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, new Uint16Array( indices ), gl.STATIC_DRAW );

    // 카메라: z축 위에서 원점(지구 중심)을 바라본다
    var eye = vec3( 0.0, 0.0, 3.3 );
    var at  = vec3( 0.0, 0.0, 0.0 );
    var up  = vec3( 0.0, 1.0, 0.0 );
    viewMatrix = lookAt( eye, at, up );
    var projectionMatrix = perspective( 45.0, canvas.width / canvas.height, 1.0, 6.0 );

    // 모델-뷰 행렬과 태양 방향은 매 프레임 바뀔 수 있어서 위치만 얻어 두고 render()에서 보낸다
    modelViewMatrixLoc = gl.getUniformLocation( program, "modelViewMatrix" );
    lightPositionLoc   = gl.getUniformLocation( program, "lightPosition" );

    // 프로그램이 도는 동안 바뀌지 않는 uniform은 여기서 한 번만 보낸다
    gl.uniformMatrix4fv( gl.getUniformLocation( program, "projectionMatrix" ), false, flatten( projectionMatrix ) );
    gl.uniform4fv( gl.getUniformLocation( program, "lightAmbient" ), flatten( lightAmbient ) );
    gl.uniform4fv( gl.getUniformLocation( program, "lightDiffuse" ), flatten( lightDiffuse ) );
    gl.uniform4fv( gl.getUniformLocation( program, "lightSpecular" ), flatten( lightSpecular ) );
    gl.uniform1f( gl.getUniformLocation( program, "shininess" ), shininess );

    setupUI();
    buildEarth();
    render();
};


// ---------------------------------------------------------------------------
//  격자
// ---------------------------------------------------------------------------

// 격자의 (i행, j열) 정점이 배열에서 몇 번째인지 돌려준다.
// 경도는 한 바퀴 돌면 처음으로 이어지므로, j가 범위를 벗어나면 반대쪽 열로 넘긴다.
function vertexIndex( i, j )
{
    return i * COLS + ( j + COLS ) % COLS;
}

function latitudeOf( i )  { return 90 - i * STEP; }      // i행의 위도
function longitudeOf( j ) { return -180 + j * STEP; }    // j열의 경도

// (i행, j열) 격자점의 고도(m)
function elevationAt( i, j )
{
    return elevationData[ ( i * STEP ) * ELEV_COLS + ( j * STEP ) ];
}

// 위도, 경도, 반지름을 3차원 좌표로 바꾼다. 극축이 y축이다.
function spherePoint( lat, lon, r )
{
    var phi = radians( lat );
    var lam = radians( lon );
    return vec4( r * Math.cos( phi ) * Math.sin( lam ),
                 r * Math.sin( phi ),
                 r * Math.cos( phi ) * Math.cos( lam ),
                 1.0 );
}

// 사각형 하나 = 삼각형 두 개 (06강의 quad와 같은 순서, 바깥에서 볼 때 반시계)
//
//   a(북서) ---- d(북동)
//      |       /  |
//      |     /    |
//      |   /      |
//   b(남서) ---- c(남동)
function quad( a, b, c, d )
{
    indices.push( a, b, c );
    indices.push( a, c, d );
}

function buildIndices()
{
    indices = [];
    for ( var i = 0; i < ROWS - 1; ++i ) {
        for ( var j = 0; j < COLS; ++j ) {
            // 마지막 열(j = COLS-1)의 오른쪽은 vertexIndex()가 0열로 이어 준다
            quad( vertexIndex( i, j ),
                  vertexIndex( i + 1, j ),
                  vertexIndex( i + 1, j + 1 ),
                  vertexIndex( i, j + 1 ) );
        }
    }
}


// ---------------------------------------------------------------------------
//  정점 데이터 생성
// ---------------------------------------------------------------------------

// 정점 위치, 법선, 색을 만들어 GPU로 보낸다.
// 고도 과장 배율이나 해저 지형 표시가 바뀌면 다시 호출한다.
function buildEarth()
{
    points = [];
    colors = [];

    for ( var i = 0; i < ROWS; ++i ) {
        for ( var j = 0; j < COLS; ++j ) {
            var lat = latitudeOf( i );
            var lon = longitudeOf( j );
            var h = elevationAt( i, j );

            // 바다(h < 0)는 해수면(0)에 두고, 해저 지형 보기일 때만 실제 깊이를 쓴다
            var d = ( h > 0 || showSeafloor ) ? h : 0;

            // p' = p + d n. 구에서는 법선이 반지름 방향이라 반지름을 늘리는 것과 같다
            var r = 1.0 + exaggeration * d / EARTH_RADIUS;
            points.push( spherePoint( lat, lon, r ) );
            colors.push( elevationColor( h, lat ) );
        }
    }

    // 법선은 밀어낸 뒤의 위치가 모두 정해져야 구할 수 있어서 따로 계산한다
    computeNormals();

    gl.bindBuffer( gl.ARRAY_BUFFER, positionBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten( points ), gl.STATIC_DRAW );

    gl.bindBuffer( gl.ARRAY_BUFFER, normalBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten( normals ), gl.STATIC_DRAW );

    gl.bindBuffer( gl.ARRAY_BUFFER, colorBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten( colors ), gl.STATIC_DRAW );
}

// 밀어낸 뒤의 정점 위치로 법선을 다시 구한다.
// 남북 이웃을 잇는 벡터와 동서 이웃을 잇는 벡터가 그 점에서의 접선이고,
// 두 접선의 외적이 법선이다.
function computeNormals()
{
    normals = [];

    for ( var i = 0; i < ROWS; ++i ) {
        for ( var j = 0; j < COLS; ++j ) {

            // 극점은 한 점에 모여 있어 접선을 만들 수 없으므로 축 방향을 그대로 쓴다
            if ( i === 0 )        { normals.push( vec4( 0.0,  1.0, 0.0, 0.0 ) ); continue; }
            if ( i === ROWS - 1 ) { normals.push( vec4( 0.0, -1.0, 0.0, 0.0 ) ); continue; }

            var north = points[ vertexIndex( i - 1, j ) ];
            var south = points[ vertexIndex( i + 1, j ) ];
            var west  = points[ vertexIndex( i, j - 1 ) ];
            var east  = points[ vertexIndex( i, j + 1 ) ];

            var toSouth = subtract( south, north );
            var toEast  = subtract( east, west );

            // (남쪽 접선) x (동쪽 접선) 이 바깥을 향한다
            var n = normalize( cross( toSouth, toEast ) );
            normals.push( vec4( n[0], n[1], n[2], 0.0 ) );
        }
    }
}


// ---------------------------------------------------------------------------
//  고도 → 색
// ---------------------------------------------------------------------------

// 색 표에서 고도 h가 속한 구간을 찾아 양 끝 색을 mix()로 섞는다
function rampColor( table, h )
{
    if ( h <= table[0][0] ) return table[0][1];

    for ( var k = 1; k < table.length; ++k ) {
        if ( h <= table[k][0] ) {
            var t = ( h - table[k - 1][0] ) / ( table[k][0] - table[k - 1][0] );
            return mix( table[k - 1][1], table[k][1], t );
        }
    }
    return table[ table.length - 1 ][1];
}

// 그 위도에서 땅이 눈으로 완전히 덮이는 고도(m).
// 위도가 높을수록 낮아진다고 보고 직선으로 근사했다.
function snowLine( lat )
{
    if ( lat <= -60 ) return 0;    // 남위 60도 이남의 땅은 남극 대륙이라 전부 얼음으로 본다

    var a = Math.abs( lat );
    if ( a <= 30 ) return 5000;
    if ( a >= 75 ) return 0;
    return 5000 * ( 75 - a ) / 45;
}

// 고도와 위도로 정점 색을 정한다. a 성분에는 반사광 세기를 넣는다.
function elevationColor( h, lat )
{
    var c;
    var shine = 0.0;

    if ( h < 0 ) {
        // 바다: 깊을수록 어두운 파랑. 물이 있을 때만 햇빛이 반짝이게 한다
        c = rampColor( SEA_COLORS, h );
        if ( !showSeafloor ) shine = 0.6;
    }
    else {
        // 육지: 고도별 색. 설선 500 m 아래부터 흰색을 섞기 시작해 설선에서 완전히 흰색이 된다
        c = rampColor( LAND_COLORS, h );
        var t = ( h - ( snowLine( lat ) - 500 ) ) / 500;
        t = Math.max( 0, Math.min( 1, t ) );
        c = mix( c, SNOW_COLOR, t );
    }

    return vec4( c[0], c[1], c[2], shine );
}


// ---------------------------------------------------------------------------
//  UI
// ---------------------------------------------------------------------------

function setupUI()
{
    // 고도 과장 배율: 정점 위치가 바뀌므로 buildEarth()를 다시 부른다
    var exaggerationInput = document.getElementById( "exaggeration" );
    exaggerationInput.addEventListener( "input", function () {
        exaggeration = parseFloat( exaggerationInput.value );
        document.getElementById( "exaggerationText" ).textContent = exaggeration;
        buildEarth();
    });

    document.getElementById( "seafloor" ).addEventListener( "change", function ( e ) {
        showSeafloor = e.target.checked;
        buildEarth();
    });

    // 자전과 태양은 render()가 매 프레임 값을 읽어 가므로 변수만 바꾸면 된다
    var spinButton = document.getElementById( "spinToggle" );
    spinButton.onclick = function () {
        spinning = !spinning;
        spinButton.textContent = spinning ? "자전 정지" : "자전 시작";
    };
    document.getElementById( "spinSpeed" ).addEventListener( "input", function ( e ) {
        spinSpeed = parseFloat( e.target.value );
    });

    document.getElementById( "sunAngle" ).addEventListener( "input", function ( e ) {
        sunAngle = parseFloat( e.target.value );
        document.getElementById( "sunText" ).textContent = sunAngle;
    });
    document.getElementById( "sunMove" ).addEventListener( "change", function ( e ) {
        sunMoving = e.target.checked;
    });
}


// ---------------------------------------------------------------------------
//  렌더링
// ---------------------------------------------------------------------------

function render()
{
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

    if ( spinning ) {
        spinAngle = ( spinAngle + spinSpeed ) % 360;
    }
    if ( sunMoving ) {
        sunAngle = ( sunAngle + 0.5 ) % 360;
        document.getElementById( "sunAngle" ).value = sunAngle;
        document.getElementById( "sunText" ).textContent = Math.round( sunAngle );
    }

    // 모델 변환: 자전축(y축)을 중심으로 먼저 돌리고, 그다음 축을 23.5도 기울인다.
    // 순서를 바꾸면 기울어진 축 자체가 y축 둘레를 돌게 된다.
    var modelMatrix = mult( rotateZ( -AXIS_TILT ), rotateY( spinAngle ) );
    var modelViewMatrix = mult( viewMatrix, modelMatrix );
    gl.uniformMatrix4fv( modelViewMatrixLoc, false, flatten( modelViewMatrix ) );

    // 태양: xz 평면 위의 방향에서 비추는 평행 광원 (w = 0).
    // 카메라가 회전 없이 z축 위에 있어서 이 방향이 눈 좌표에서도 그대로다
    var s = radians( sunAngle );
    var lightPosition = vec4( Math.sin( s ), 0.0, Math.cos( s ), 0.0 );
    gl.uniform4fv( lightPositionLoc, flatten( lightPosition ) );

    gl.drawElements( gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0 );

    requestAnimFrame( render );
}
