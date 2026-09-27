"use strict";

var canvas;
var gl;

var points = [];
var NumTimesToSubdivide = 3;
var MAX_LEVEL = 6;   // 8^6 = 262,144개. 이보다 크면 한 칸이 1픽셀보다 작아진다

// 여러 함수에서 쓰도록 전역으로 옮긴 것들
var bufferId;
var vPosition;
var uColorLoc;       // shader의 uColor 위치

// 색상 상태 (각 성분 0.0 ~ 1.0)
var carpetColor = vec4( 0.12, 0.37, 0.66, 1.0 );
var bgColor     = vec4( 1.0, 1.0, 1.0, 1.0 );

window.onload = function init()
{
    canvas = document.getElementById( "gl-canvas" );

    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    gl.viewport( 0, 0, canvas.width, canvas.height );

    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    // 버퍼는 처음에 한 번만 만든다. 내용은 buildCarpet()에서 채운다
    bufferId = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, bufferId );

    vPosition = gl.getAttribLocation( program, "vPosition" );
    gl.vertexAttribPointer( vPosition, 2, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition );

    // [6단계] uniform 변수 uColor의 위치를 얻어 둔다
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

    render();
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

    // 색상은 uniform 값만 바꾸면 되므로
    // buildCarpet()(정점 재생성)이 아니라 render()만 호출한다
    document.getElementById( "carpetColor" ).addEventListener( "input", function ( e ) {
        carpetColor = hexToVec4( e.target.value );
        render();
    });
    document.getElementById( "bgColor" ).addEventListener( "input", function ( e ) {
        bgColor = hexToVec4( e.target.value );
        render();
    });
}

// [6단계] color input의 "#rrggbb"(0~255, 16진수)를 vec4(r, g, b, 1.0)(0.0~1.0)으로 변환
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

    // 같은 값이면 다시 계산하지 않는다 (6단계는 계산이 무겁다)
    if ( n === NumTimesToSubdivide ) return;

    NumTimesToSubdivide = n;
    document.getElementById( "level" ).value = n;
    document.getElementById( "levelText" ).textContent = n;

    buildCarpet();
}

function render()
{
    // [6단계] 배경색은 clearColor로, 카펫 색은 uniform으로 전달
    gl.clearColor( bgColor[0], bgColor[1], bgColor[2], 1.0 );
    gl.clear( gl.COLOR_BUFFER_BIT );

    gl.uniform4fv( uColorLoc, flatten( carpetColor ) );
    gl.drawArrays( gl.TRIANGLES, 0, points.length );
}