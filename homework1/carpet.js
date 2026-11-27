"use strict";

var canvas;
var gl;

var points = [];
var NumTimesToSubdivide = 3;
var MAX_LEVEL = 6;   // 8^6 = 262,144개. 이보다 크면 한 칸이 1픽셀보다 작아진다

// 여러 함수에서 쓰도록 전역으로 옮긴 것들
var bufferId;
var edgeBufferId;    //  삼각형 테두리(선분)용 버퍼
var vPosition;
var uColorLoc;

// 색상 상태 (각 성분 0.0 ~ 1.0)
var carpetColor = vec4( 0.12, 0.37, 0.66, 1.0 );
var bgColor     = vec4( 1.0, 1.0, 1.0, 1.0 );

// 선분 정점 (2개가 선 하나) 과 표시 여부
var edges = [];
var showEdges = false;

window.onload = function init()
{
    canvas = document.getElementById( "gl-canvas" );

    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    gl.viewport( 0, 0, canvas.width, canvas.height );

    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    // 버퍼는 처음에 한 번만 만든다. 내용은 buildCarpet(), buildEdges()에서 채운다
    bufferId = gl.createBuffer();
    edgeBufferId = gl.createBuffer();   // 

    // 버퍼가 두 개라서 vertexAttribPointer는 그릴 때마다 render()에서 연결한다
    vPosition = gl.getAttribLocation( program, "vPosition" );
    gl.enableVertexAttribArray( vPosition );

    // uniform 변수 uColor의 위치를 얻어 둔다
    uColorLoc = gl.getUniformLocation( program, "uColor" );

    setupUI();
    buildCarpet();
};

// 분할 횟수가 바뀔 때마다 호출: 정점을 새로 만들어 버퍼에 다시 올린다
function buildCarpet()
{
    points = [];   // 이전 단계의 정점을 비우지 않으면 계속 쌓인다

    var a = vec2( -0.9, -0.9 );
    var c = vec2(  0.9,  0.9 );
    divideSquare( a, c, NumTimesToSubdivide );

    gl.bindBuffer( gl.ARRAY_BUFFER, bufferId );
    gl.bufferData( gl.ARRAY_BUFFER, flatten( points ), gl.STATIC_DRAW );

    buildEdges();   //  분할이 바뀌면 선분도 다시 만든다
    render();
}

// 삼각형 하나의 세 변을 선분 3개(정점 6개)로 만든다.
// 체크박스가 꺼져 있으면 계산하지 않는다 (6단계에서는 정점이 300만 개가 넘음)
function buildEdges()
{
    edges = [];
    if ( !showEdges ) return;

    // points에는 정점이 3개씩(삼각형 하나씩) 들어 있다
    for ( var i = 0; i < points.length; i += 3 ) {
        var p0 = points[i], p1 = points[i + 1], p2 = points[i + 2];
        edges.push( p0, p1,  p1, p2,  p2, p0 );   // 변 3개
    }

    gl.bindBuffer( gl.ARRAY_BUFFER, edgeBufferId );
    gl.bufferData( gl.ARRAY_BUFFER, flatten( edges ), gl.STATIC_DRAW );
}

// 정사각형 하나 = 삼각형 두 개
function square( a, c )
{
    var b = vec2( c[0], a[1] );
    var d = vec2( a[0], c[1] );

    points.push( a, b, c );
    points.push( a, c, d );
}

// 3x3으로 나누고 가운데 칸을 버리는 재귀 분할
function divideSquare( a, c, count )
{
    if ( count === 0 ) {
        square( a, c );
        return;
    }

    var w = ( c[0] - a[0] ) / 3;
    var h = ( c[1] - a[1] ) / 3;

    for ( var row = 0; row < 3; ++row ) {
        for ( var col = 0; col < 3; ++col ) {
            if ( row === 1 && col === 1 ) continue;

            var subA = vec2( a[0] + col * w,       a[1] + row * h );
            var subC = vec2( a[0] + (col + 1) * w, a[1] + (row + 1) * h );

            divideSquare( subA, subC, count - 1 );
        }
    }
}

// ---------------- UI ----------------

function setupUI()
{
    var slider = document.getElementById( "level" );

    // 슬라이더를 움직이는 동안 계속 반영
    slider.addEventListener( "input", function () {
        setLevel( parseInt( slider.value ) );
    });

    document.getElementById( "levelDown" ).onclick = function () {
        setLevel( NumTimesToSubdivide - 1 );
    };
    document.getElementById( "levelUp" ).onclick = function () {
        setLevel( NumTimesToSubdivide + 1 );
    };

    // 색상은 uniform 값만 바꾸면 되므로 render()만 호출
    document.getElementById( "carpetColor" ).addEventListener( "input", function ( e ) {
        carpetColor = hexToVec4( e.target.value );
        render();
    });
    document.getElementById( "bgColor" ).addEventListener( "input", function ( e ) {
        bgColor = hexToVec4( e.target.value );
        render();
    });

    // 체크박스를 켜면 선분을 만들고, 끄면 비운다
    document.getElementById( "showEdges" ).addEventListener( "change", function ( e ) {
        showEdges = e.target.checked;
        buildEdges();
        render();
    });
}

// color input의 "#rrggbb"(0~255, 16진수)를 vec4(r, g, b, 1.0)(0.0~1.0)으로 변환
function hexToVec4( hex )
{
    var r = parseInt( hex.substr( 1, 2 ), 16 ) / 255;
    var g = parseInt( hex.substr( 3, 2 ), 16 ) / 255;
    var b = parseInt( hex.substr( 5, 2 ), 16 ) / 255;
    return vec4( r, g, b, 1.0 );
}

function setLevel( n )
{
    // 0 ~ MAX_LEVEL 범위를 벗어나지 않게 고정
    n = Math.max( 0, Math.min( MAX_LEVEL, n ) );

    // 같은 값이면 다시 계산하지 않는다 
    if ( n === NumTimesToSubdivide ) return;

    NumTimesToSubdivide = n;
    document.getElementById( "level" ).value = n;
    document.getElementById( "levelText" ).textContent = n;

    buildCarpet();
}

function render()
{
    gl.clearColor( bgColor[0], bgColor[1], bgColor[2], 1.0 );
    gl.clear( gl.COLOR_BUFFER_BIT );

    // 1) 카펫: 카펫 버퍼를 연결하고 삼각형으로 채운다
    gl.bindBuffer( gl.ARRAY_BUFFER, bufferId );
    gl.vertexAttribPointer( vPosition, 2, gl.FLOAT, false, 0, 0 );
    gl.uniform4fv( uColorLoc, flatten( carpetColor ) );
    gl.drawArrays( gl.TRIANGLES, 0, points.length );

    // 2)  분할 선: 선분 버퍼로 바꿔 연결하고, uColor만 선 색으로 바꿔 덧그린다
    if ( showEdges ) {
        gl.bindBuffer( gl.ARRAY_BUFFER, edgeBufferId );
        gl.vertexAttribPointer( vPosition, 2, gl.FLOAT, false, 0, 0 );
        gl.uniform4fv( uColorLoc, flatten( edgeColor() ) );
        gl.drawArrays( gl.LINES, 0, edges.length );
    }
}

//배경이 밝으면 검은 선, 어두우면 흰 선
// 밝기 = 0.299R + 0.587G + 0.114B (YUV의 Y를 구하는 계수와 같음)
function edgeColor()
{
    var lum = 0.299 * bgColor[0] + 0.587 * bgColor[1] + 0.114 * bgColor[2];
    return ( lum > 0.5 ) ? vec4( 0.0, 0.0, 0.0, 1.0 ) : vec4( 1.0, 1.0, 1.0, 1.0 );
}