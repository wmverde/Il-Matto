"use strict";

var CABLES=CABLES||{};
CABLES.OPS=CABLES.OPS||{};

var Ops=Ops || {};
Ops.Gl=Ops.Gl || {};
Ops.Anim=Ops.Anim || {};
Ops.Math=Ops.Math || {};
Ops.Vars=Ops.Vars || {};
Ops.Number=Ops.Number || {};
Ops.Gl.GLTF=Ops.Gl.GLTF || {};
Ops.Trigger=Ops.Trigger || {};
Ops.Gl.Phong=Ops.Gl.Phong || {};
Ops.Graphics=Ops.Graphics || {};
Ops.Extension=Ops.Extension || {};
Ops.Gl.Matrix=Ops.Gl.Matrix || {};
Ops.Gl.Meshes=Ops.Gl.Meshes || {};
Ops.Gl.Shader=Ops.Gl.Shader || {};
Ops.Graphics.Geometry=Ops.Graphics.Geometry || {};
Ops.Extension.OpenType=Ops.Extension.OpenType || {};



// **************************************************************
// 
// Ops.Gl.MainLoop_v2
// 
// **************************************************************

Ops.Gl.MainLoop_v2= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    hdpi = op.inFloat("Max Pixel Density (DPR)", 2),
    fpsLimit = op.inValue("FPS Limit", 0),
    reduceFocusFPS = op.inValueBool("Reduce FPS unfocussed", false),
    clear = op.inValueBool("Transparent", false),
    active = op.inValueBool("Active", 1),
    inFocus = op.inValueBool("Focus canvas", 1),
    trigger = op.outTrigger("trigger"),
    width = op.outNumber("width"),
    height = op.outNumber("height"),
    outPixel = op.outNumber("Pixel Density");

op.onAnimFrame = render;
hdpi.onChange = updateHdpi;

const cgl = op.patch.cg = op.patch.cgl;
let rframes = 0;
let rframeStart = 0;
let timeOutTest = null;
let addedListener = false;
if (!op.patch.cgl) op.uiAttr({ "error": "No webgl cgl context" });

const identTranslate = vec3.create();
vec3.set(identTranslate, 0, 0, 0);
const identTranslateView = vec3.create();
vec3.set(identTranslateView, 0, 0, -2);

let firstTime = true;
let fsElement = null;
let winhasFocus = true;
let winVisible = true;

window.addEventListener("blur", () => { winhasFocus = false; });
window.addEventListener("focus", () => { winhasFocus = true; });
document.addEventListener("visibilitychange", () => { winVisible = !document.hidden; });

testMultiMainloop();

// op.patch.cgl.cgCanvas.forceAspect = 1.7777777;
op.patch.tempData.mainloopOp = this;

function updateHdpi()
{
    setPixelDensity();

    if (CABLES.UI)
    {
        if (hdpi.get() < 1)
            op.patch.cgl.canvas.style.imageRendering = "pixelated";
    }

    op.patch.cgl.updateSize();
    if (CABLES.UI) gui.setLayout();
}

active.onChange = function ()
{
    op.patch.removeOnAnimFrame(op);

    if (active.get())
    {
        op.setUiAttrib({ "extendTitle": "" });
        op.onAnimFrame = render;
        op.patch.addOnAnimFrame(op);
        op.log("adding again!");
    }
    else
    {
        op.setUiAttrib({ "extendTitle": "Inactive" });
    }
};

function getFpsLimit()
{
    if (reduceFocusFPS.get())
    {
        if (!winVisible) return 10;
        if (!winhasFocus) return 30;
    }

    return fpsLimit.get();
}

op.onDelete = function ()
{
    cgl.gl.clearColor(0, 0, 0.0, 0);
    cgl.gl.clear(cgl.gl.COLOR_BUFFER_BIT | cgl.gl.DEPTH_BUFFER_BIT);
};

function setPixelDensity()
{
    if (hdpi.get() != 0) op.patch.cgl.pixelDensity = Math.min(hdpi.get(), window.devicePixelRatio);
    else op.patch.cgl.pixelDensity = window.devicePixelRatio;
}

function render(time)
{
    if (!active.get()) return;
    if (cgl.aborted || cgl.canvas.clientWidth === 0 || cgl.canvas.clientHeight === 0) return;

    op.patch.cg = cgl;

    setPixelDensity();

    // if (hdpi.get())op.patch.cgl.pixelDensity = window.devicePixelRatio;

    const startTime = performance.now();

    op.patch.config.fpsLimit = getFpsLimit();

    if (cgl.canvasWidth == -1)
    {
        cgl.setCanvas(op.patch.config.glCanvasId);
        return;
    }

    if (cgl.canvasWidth != width.get() || cgl.canvasHeight != height.get())
    {
        width.set(cgl.canvasWidth / 1);
        height.set(cgl.canvasHeight / 1);
    }

    if (CABLES.now() - rframeStart > 1000)
    {
        CGL.fpsReport = CGL.fpsReport || [];
        if (op.patch.loading.getProgress() >= 1.0 && rframeStart !== 0)CGL.fpsReport.push(rframes);
        rframes = 0;
        rframeStart = CABLES.now();
    }
    CGL.MESH.lastShader = null;
    CGL.MESH.lastMesh = null;

    cgl.renderStart(cgl, identTranslate, identTranslateView);

    if (!clear.get()) cgl.gl.clearColor(0, 0, 0, 1);
    else cgl.gl.clearColor(0, 0, 0, 0);

    cgl.gl.clear(cgl.gl.COLOR_BUFFER_BIT | cgl.gl.DEPTH_BUFFER_BIT);

    trigger.trigger();

    if (CGL.MESH.lastMesh)CGL.MESH.lastMesh.unBind();

    if (CGL.Texture.previewTexture)
    {
        if (!CGL.Texture.texturePreviewer) CGL.Texture.texturePreviewer = new CGL.Texture.texturePreview(cgl);
        CGL.Texture.texturePreviewer.render(CGL.Texture.previewTexture);
    }
    cgl.renderEnd(cgl);

    op.patch.cg = null;

    if (!clear.get())
    {
        cgl.gl.clearColor(1, 1, 1, 1);
        cgl.gl.colorMask(false, false, false, true);
        cgl.gl.clear(cgl.gl.COLOR_BUFFER_BIT);
        cgl.gl.colorMask(true, true, true, true);
    }

    if (!cgl.tempData.phong)cgl.tempData.phong = {};
    rframes++;
    if (firstTime)
    {
        if (inFocus.get()) cgl.canvas.focus();
        firstTime = false;
    }

    outPixel.set(op.patch.cgl.pixelDensity);
    op.patch.cgl.profileData.profileMainloopMs = performance.now() - startTime;
}

function testMultiMainloop()
{
    clearTimeout(timeOutTest);
    timeOutTest = setTimeout(
        () =>
        {
            if (op.patch.getOpsByObjName(op.name).length > 1)
            {
                op.setUiError("multimainloop", "there should only be one mainloop op!");
                if (!addedListener)addedListener = op.patch.addEventListener("onOpDelete", testMultiMainloop);
            }
            else op.setUiError("multimainloop", null, 1);
        }, 500);
}

}
};

CABLES.OPS["f1029550-d877-42da-9b1e-63a5163a0350"]={f:Ops.Gl.MainLoop_v2,objName:"Ops.Gl.MainLoop_v2"};




// **************************************************************
// 
// Ops.Graphics.OrbitControls_v3
// 
// **************************************************************

Ops.Graphics.OrbitControls_v3= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    render = op.inTrigger("render"),
    minDist = op.inValueFloat("min distance", 1),
    maxDist = op.inValueFloat("max distance", 999999),

    minRotY = op.inValue("min rot y", 0),
    maxRotY = op.inValue("max rot y", 0),

    initialRadius = op.inValue("initial radius", 2),
    initialAxis = op.inValueSlider("initial axis y", 0.5),
    initialX = op.inValueSlider("initial axis x", 0.25),

    smoothness = op.inValueSlider("Smoothness", 1.0),
    speedX = op.inValue("Speed X", 1),
    speedY = op.inValue("Speed Y", 1),

    active = op.inValueBool("Active", true),

    allowPanning = op.inValueBool("Allow Panning", true),
    allowZooming = op.inValueBool("Allow Zooming", true),
    allowRotation = op.inValueBool("Allow Rotation", true),
    restricted = op.inValueBool("restricted", true),
    inIdentity = op.inBool("Identity", true),
    inReset = op.inTriggerButton("Reset"),

    trigger = op.outTrigger("trigger"),
    outRadius = op.outNumber("radius"),
    outXDeg = op.outNumber("Rot X"),
    outYDeg = op.outNumber("Rot Y");
    // outCoords = op.outArray("Eye/Target Pos");

op.setPortGroup("Initial Values", [initialAxis, initialX, initialRadius]);
op.setPortGroup("Interaction", [smoothness, speedX, speedY]);
op.setPortGroup("Boundaries", [minRotY, maxRotY, minDist, maxDist]);

const halfCircle = Math.PI;
const fullCircle = Math.PI * 2;

const
    vUp = vec3.create(),
    vCenter = vec3.create(),
    viewMatrix = mat4.create(),
    tempViewMatrix = mat4.create(),
    vOffset = vec3.create(),
    finalEyeAbs = vec3.create(),
    tempEye = vec3.create(),
    finalEye = vec3.create(),
    tempCenter = vec3.create(),
    finalCenter = vec3.create();

let eye = vec3.create(),
    mouseDown = false,
    radius = 5,
    lastMouseX = 0, lastMouseY = 0,
    percX = 0, percY = 0,
    px = 0,
    py = 0,
    divisor = 1,
    element = null,
    initializing = true,
    eyeTargetCoord = [0, 0, 0, 0, 0, 0],
    lastPy = 0;

op.onDelete = unbind;
smoothness.onChange = updateSmoothness;
initialRadius.onChange =
    inReset.onTriggered = reset;

eye = circlePos(0);
vec3.set(vCenter, 0, 0, 0);
vec3.set(vUp, 0, 1, 0);
updateSmoothness();
reset();

function reset()
{
    let off = 0;

    if (px % fullCircle < -halfCircle)
    {
        off = -fullCircle;
        px %= -fullCircle;
    }
    else
    if (px % fullCircle > halfCircle)
    {
        off = fullCircle;
        px %= fullCircle;
    }
    else px %= fullCircle;

    py %= (Math.PI);

    vec3.set(vOffset, 0, 0, 0);
    vec3.set(vCenter, 0, 0, 0);
    vec3.set(vUp, 0, 1, 0);

    percX = (initialX.get() * Math.PI * 2 + off);
    percY = (initialAxis.get() - 0.5);

    radius = initialRadius.get();
    eye = circlePos(percY);
}

function updateSmoothness()
{
    divisor = smoothness.get() * 10 + 1;
}

function ip(val, goal)
{
    if (initializing) return goal;
    return val + (goal - val) / divisor;
}

render.onTriggered = function ()
{
    const cgl = op.patch.cg;
    if (!cgl) return;

    if (!element)
    {
        setElement(cgl.canvas);
        bind();
    }

    cgl.pushViewMatrix();

    px = ip(px, percX);
    py = ip(py, percY);

    let degY = (py + 0.5) * 180;

    if (minRotY.get() !== 0 && degY < minRotY.get())
    {
        degY = minRotY.get();
        py = lastPy;
    }
    else if (maxRotY.get() !== 0 && degY > maxRotY.get())
    {
        degY = maxRotY.get();
        py = lastPy;
    }
    else
    {
        lastPy = py;
    }

    const degX = (px) * CGL.RAD2DEG;

    outYDeg.set(degY);
    outXDeg.set(degX);

    circlePosi(eye, py);

    vec3.add(tempEye, eye, vOffset);
    vec3.add(tempCenter, vCenter, vOffset);

    finalEye[0] = ip(finalEye[0], tempEye[0]);
    finalEye[1] = ip(finalEye[1], tempEye[1]);
    finalEye[2] = ip(finalEye[2], tempEye[2]);

    finalCenter[0] = ip(finalCenter[0], tempCenter[0]);
    finalCenter[1] = ip(finalCenter[1], tempCenter[1]);
    finalCenter[2] = ip(finalCenter[2], tempCenter[2]);

    // eyeTargetCoord[0] = finalEye[0];
    // eyeTargetCoord[1] = finalEye[1];
    // eyeTargetCoord[2] = finalEye[2];
    // eyeTargetCoord[3] = finalCenter[0];
    // eyeTargetCoord[4] = finalCenter[1];
    // eyeTargetCoord[5] = finalCenter[2];
    // outCoords.setRef(eyeTargetCoord);

    const empty = vec3.create();

    if (inIdentity.get()) mat4.identity(cgl.vMatrix);

    mat4.lookAt(viewMatrix, finalEye, finalCenter, vUp);
    mat4.rotate(viewMatrix, viewMatrix, px, vUp);

    // finaly multiply current scene viewmatrix
    mat4.multiply(cgl.vMatrix, cgl.vMatrix, viewMatrix);

    trigger.trigger();
    cgl.popViewMatrix();
    initializing = false;
};

function circlePosi(vec, perc)
{
    if (radius < minDist.get()) radius = minDist.get();
    if (radius > maxDist.get()) radius = maxDist.get();

    outRadius.set(radius);

    let i = 0, degInRad = 0;

    degInRad = 360 * perc / 2 * CGL.DEG2RAD;
    vec3.set(vec,
        Math.cos(degInRad) * radius,
        Math.sin(degInRad) * radius,
        0);
    return vec;
}

function circlePos(perc)
{
    if (radius < minDist.get())radius = minDist.get();
    if (radius > maxDist.get())radius = maxDist.get();

    outRadius.set(radius);

    let i = 0, degInRad = 0;
    const vec = vec3.create();
    degInRad = 360 * perc / 2 * CGL.DEG2RAD;
    vec3.set(vec,
        Math.cos(degInRad) * radius,
        Math.sin(degInRad) * radius,
        0);
    return vec;
}

function onmousemove(event)
{
    if (!mouseDown) return;

    const x = event.clientX;
    const y = event.clientY;

    let movementX = (x - lastMouseX);
    let movementY = (y - lastMouseY);

    movementX *= speedX.get();
    movementY *= speedY.get();

    if (event.buttons == 2 && allowPanning.get())
    {
        vOffset[2] += movementX * 0.01;
        vOffset[1] += movementY * 0.01;
    }
    else
    if (event.buttons == 4 && allowZooming.get())
    {
        radius += movementY * 0.05;
        eye = circlePos(percY);
    }
    else
    {
        if (allowRotation.get())
        {
            percX += movementX * 0.003;
            percY += movementY * 0.002;

            if (restricted.get())
            {
                if (percY > 0.5)percY = 0.5;
                if (percY < -0.5)percY = -0.5;
            }
        }
    }

    lastMouseX = x;
    lastMouseY = y;
}

function onMouseDown(event)
{
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    mouseDown = true;

    try { element.setPointerCapture(event.pointerId); }
    catch (e) {}
}

function onMouseUp(e)
{
    mouseDown = false;

    try { element.releasePointerCapture(e.pointerId); }
    catch (e) {}
}

function lockChange()
{
    const el = op.patch.cg.canvas;

    if (document.pointerLockElement === el || document.mozPointerLockElement === el || document.webkitPointerLockElement === el)
        document.addEventListener("mousemove", onmousemove, false);
}

function onMouseEnter(e)
{
}

initialX.onChange = function ()
{
    px = percX = (initialX.get() * Math.PI * 2);
};

initialAxis.onChange = function ()
{
    py = percY = (initialAxis.get() - 0.5);
    eye = circlePos(percY);
};

const onMouseWheel = function (event)
{
    if (allowZooming.get())
    {
        const delta = CGL.getWheelSpeed(event) * 0.06;
        radius += (parseFloat(delta)) * 1.2;
        eye = circlePos(percY);
    }
};

const ontouchstart = function (event)
{
    if (event.touches && event.touches.length > 0) onMouseDown(event.touches[0]);
};

const ontouchend = function (event)
{
    onMouseUp();
};

const ontouchmove = function (event)
{
    if (event.touches && event.touches.length > 0) onmousemove(event.touches[0]);
};

active.onChange = function ()
{
    if (active.get())bind();
    else unbind();
};

function setElement(ele)
{
    unbind();
    element = ele;
    bind();
}

function bind()
{
    if (!element) return;
    if (!active.get()) return unbind();

    element.addEventListener("pointermove", onmousemove);
    element.addEventListener("pointerdown", onMouseDown);
    element.addEventListener("pointerup", onMouseUp);
    element.addEventListener("pointerleave", onMouseUp);
    element.addEventListener("pointerenter", onMouseEnter);
    element.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    element.addEventListener("wheel", onMouseWheel, { "passive": true });
}

function unbind()
{
    if (!element) return;

    element.removeEventListener("pointermove", onmousemove);
    element.removeEventListener("pointerdown", onMouseDown);
    element.removeEventListener("pointerup", onMouseUp);
    element.removeEventListener("pointerleave", onMouseUp);
    element.removeEventListener("pointerenter", onMouseUp);
    element.removeEventListener("wheel", onMouseWheel);
}

}
};

CABLES.OPS["0655b098-d2a8-4ce2-a0b9-ecb2c78f873a"]={f:Ops.Graphics.OrbitControls_v3,objName:"Ops.Graphics.OrbitControls_v3"};




// **************************************************************
// 
// Ops.Gl.Shader.BasicMaterial_v3
// 
// **************************************************************

Ops.Gl.Shader.BasicMaterial_v3= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={"basicmaterial_frag":"{{MODULES_HEAD}}\r\n\r\nIN vec2 texCoord;\r\n\r\n#ifdef VERTEX_COLORS\r\nIN vec4 vertCol;\r\n#endif\r\n\r\n#ifdef HAS_TEXTURES\r\n    IN vec2 texCoordOrig;\r\n    #ifdef HAS_TEXTURE_DIFFUSE\r\n        UNI sampler2D tex;\r\n    #endif\r\n    #ifdef HAS_TEXTURE_OPACITY\r\n        UNI sampler2D texOpacity;\r\n   #endif\r\n#endif\r\n\r\n\r\n\r\nvoid main()\r\n{\r\n    {{MODULE_BEGIN_FRAG}}\r\n    vec4 col=color;\r\n\r\n\r\n    #ifdef HAS_TEXTURES\r\n        vec2 uv=texCoord;\r\n\r\n        #ifdef CROP_TEXCOORDS\r\n            if(uv.x<0.0 || uv.x>1.0 || uv.y<0.0 || uv.y>1.0) discard;\r\n        #endif\r\n\r\n        #ifdef HAS_TEXTURE_DIFFUSE\r\n            col=texture(tex,uv);\r\n\r\n            #ifdef COLORIZE_TEXTURE\r\n                col.r*=color.r;\r\n                col.g*=color.g;\r\n                col.b*=color.b;\r\n            #endif\r\n        #endif\r\n        col.a*=color.a;\r\n        #ifdef HAS_TEXTURE_OPACITY\r\n            #ifdef TRANSFORMALPHATEXCOORDS\r\n                uv=texCoordOrig;\r\n            #endif\r\n            #ifdef ALPHA_MASK_IR\r\n                col.a*=1.0-texture(texOpacity,uv).r;\r\n            #endif\r\n            #ifdef ALPHA_MASK_IALPHA\r\n                col.a*=1.0-texture(texOpacity,uv).a;\r\n            #endif\r\n            #ifdef ALPHA_MASK_ALPHA\r\n                col.a*=texture(texOpacity,uv).a;\r\n            #endif\r\n            #ifdef ALPHA_MASK_LUMI\r\n                col.a*=dot(vec3(0.2126,0.7152,0.0722), texture(texOpacity,uv).rgb);\r\n            #endif\r\n            #ifdef ALPHA_MASK_R\r\n                col.a*=texture(texOpacity,uv).r;\r\n            #endif\r\n            #ifdef ALPHA_MASK_G\r\n                col.a*=texture(texOpacity,uv).g;\r\n            #endif\r\n            #ifdef ALPHA_MASK_B\r\n                col.a*=texture(texOpacity,uv).b;\r\n            #endif\r\n            // #endif\r\n        #endif\r\n    #endif\r\n\r\n    {{MODULE_COLOR}}\r\n\r\n    #ifdef DISCARDTRANS\r\n        if(col.a<0.2) discard;\r\n    #endif\r\n\r\n    #ifdef VERTEX_COLORS\r\n        col*=vertCol;\r\n    #endif\r\n\r\n    outColor = col;\r\n}\r\n","basicmaterial_vert":"\r\n{{MODULES_HEAD}}\r\n\r\nOUT vec2 texCoord;\r\nOUT vec2 texCoordOrig;\r\n\r\nUNI mat4 projMatrix;\r\nUNI mat4 modelMatrix;\r\nUNI mat4 viewMatrix;\r\n\r\n#ifdef HAS_TEXTURES\r\n    UNI float diffuseRepeatX;\r\n    UNI float diffuseRepeatY;\r\n    UNI float texOffsetX;\r\n    UNI float texOffsetY;\r\n#endif\r\n\r\n#ifdef VERTEX_COLORS\r\n    in vec4 attrVertColor;\r\n    out vec4 vertCol;\r\n\r\n#endif\r\n\r\n\r\nvoid main()\r\n{\r\n    mat4 mMatrix=modelMatrix;\r\n    mat4 modelViewMatrix;\r\n\r\n    norm=attrVertNormal;\r\n    texCoordOrig=attrTexCoord;\r\n    texCoord=attrTexCoord;\r\n    #ifdef HAS_TEXTURES\r\n        texCoord.x=texCoord.x*diffuseRepeatX+texOffsetX;\r\n        texCoord.y=(1.0-texCoord.y)*diffuseRepeatY+texOffsetY;\r\n    #endif\r\n\r\n    #ifdef VERTEX_COLORS\r\n        vertCol=attrVertColor;\r\n    #endif\r\n\r\n    vec4 pos = vec4(vPosition, 1.0);\r\n\r\n    #ifdef BILLBOARD\r\n       vec3 position=vPosition;\r\n       modelViewMatrix=viewMatrix*modelMatrix;\r\n\r\n       gl_Position = projMatrix * modelViewMatrix * vec4((\r\n           position.x * vec3(\r\n               modelViewMatrix[0][0],\r\n               modelViewMatrix[1][0],\r\n               modelViewMatrix[2][0] ) +\r\n           position.y * vec3(\r\n               modelViewMatrix[0][1],\r\n               modelViewMatrix[1][1],\r\n               modelViewMatrix[2][1]) ), 1.0);\r\n    #endif\r\n\r\n    {{MODULE_VERTEX_POSITION}}\r\n\r\n    #ifndef BILLBOARD\r\n        modelViewMatrix=viewMatrix * mMatrix;\r\n\r\n        {{MODULE_VERTEX_MODELVIEW}}\r\n\r\n    #endif\r\n\r\n    // mat4 modelViewMatrix=viewMatrix*mMatrix;\r\n\r\n    #ifndef BILLBOARD\r\n        // gl_Position = projMatrix * viewMatrix * modelMatrix * pos;\r\n        gl_Position = projMatrix * modelViewMatrix * pos;\r\n    #endif\r\n}\r\n",};
const render = op.inTrigger("render");
const trigger = op.outTrigger("trigger");
const shaderOut = op.outObject("shader", null, "shader");

shaderOut.ignoreValueSerialize = true;

op.toWorkPortsNeedToBeLinked(render);
op.toWorkShouldNotBeChild("Ops.Gl.TextureEffects.ImageCompose", CABLES.OP_PORT_TYPE_FUNCTION);

const cgl = op.patch.cgl;

const shader = new CGL.Shader(cgl, "basicmaterial", this);
shader.addAttribute({ "type": "vec3", "name": "vPosition" });
shader.addAttribute({ "type": "vec2", "name": "attrTexCoord" });
shader.addAttribute({ "type": "vec3", "name": "attrVertNormal", "nameFrag": "norm" });
shader.addAttribute({ "type": "float", "name": "attrVertIndex" });

shader.setModules(["MODULE_VERTEX_POSITION", "MODULE_COLOR", "MODULE_BEGIN_FRAG", "MODULE_VERTEX_MODELVIEW"]);

shader.setSource(attachments.basicmaterial_vert, attachments.basicmaterial_frag);

shaderOut.setRef(shader);

render.onTriggered = doRender;

// rgba colors
const r = op.inValueSlider("r", Math.random());
const g = op.inValueSlider("g", Math.random());
const b = op.inValueSlider("b", Math.random());
const a = op.inValueSlider("a", 1);
r.setUiAttribs({ "colorPick": true });

// const uniColor=new CGL.Uniform(shader,'4f','color',r,g,b,a);
const colUni = shader.addUniformFrag("4f", "color", r, g, b, a);

shader.uniformColorDiffuse = colUni;

// diffuse outTexture

const diffuseTexture = op.inTexture("texture");
let diffuseTextureUniform = null;
diffuseTexture.onChange = updateDiffuseTexture;

const colorizeTexture = op.inValueBool("colorizeTexture", false);
const vertexColors = op.inValueBool("Vertex Colors", false);

// opacity texture
const textureOpacity = op.inTexture("textureOpacity");
let textureOpacityUniform = null;

const alphaMaskSource = op.inSwitch("Alpha Mask Source", ["Luminance", "R", "G", "B", "A", "1-A", "1-R"], "Luminance");
alphaMaskSource.setUiAttribs({ "greyout": true });
textureOpacity.onChange = updateOpacity;

const texCoordAlpha = op.inValueBool("Opacity TexCoords Transform", false);
const discardTransPxl = op.inValueBool("Discard Transparent Pixels");

// texture coords
const
    diffuseRepeatX = op.inValue("diffuseRepeatX", 1),
    diffuseRepeatY = op.inValue("diffuseRepeatY", 1),
    diffuseOffsetX = op.inValue("Tex Offset X", 0),
    diffuseOffsetY = op.inValue("Tex Offset Y", 0),
    cropRepeat = op.inBool("Crop TexCoords", false);

shader.addUniformFrag("f", "diffuseRepeatX", diffuseRepeatX);
shader.addUniformFrag("f", "diffuseRepeatY", diffuseRepeatY);
shader.addUniformFrag("f", "texOffsetX", diffuseOffsetX);
shader.addUniformFrag("f", "texOffsetY", diffuseOffsetY);

const doBillboard = op.inValueBool("billboard", false);

alphaMaskSource.onChange =
    doBillboard.onChange =
    discardTransPxl.onChange =
    texCoordAlpha.onChange =
    cropRepeat.onChange =
    vertexColors.onChange =
    colorizeTexture.onChange = updateDefines;

op.setPortGroup("Color", [r, g, b, a]);
op.setPortGroup("Color Texture", [diffuseTexture, vertexColors, colorizeTexture]);
op.setPortGroup("Opacity", [textureOpacity, alphaMaskSource, discardTransPxl, texCoordAlpha]);
op.setPortGroup("Texture Transform", [diffuseRepeatX, diffuseRepeatY, diffuseOffsetX, diffuseOffsetY, cropRepeat]);

updateOpacity();
updateDiffuseTexture();

op.preRender = function ()
{
    shader.bind();
    doRender();
    if (!shader) return;
};

function doRender()
{
    op.checkGraphicsApi();
    cgl.pushShader(shader);
    shader.popTextures();

    if (diffuseTextureUniform && diffuseTexture.get()) shader.pushTexture(diffuseTextureUniform, diffuseTexture.get());
    if (textureOpacityUniform && textureOpacity.get()) shader.pushTexture(textureOpacityUniform, textureOpacity.get());

    trigger.trigger();

    cgl.popShader();
}

function updateOpacity()
{
    if (textureOpacity.get())
    {
        if (textureOpacityUniform !== null) return;
        shader.removeUniform("texOpacity");
        shader.define("HAS_TEXTURE_OPACITY");
        if (!textureOpacityUniform)textureOpacityUniform = new CGL.Uniform(shader, "t", "texOpacity");
    }
    else
    {
        shader.removeUniform("texOpacity");
        shader.removeDefine("HAS_TEXTURE_OPACITY");
        textureOpacityUniform = null;
    }

    updateDefines();
}

function updateDiffuseTexture()
{
    if (diffuseTexture.get())
    {
        if (!shader.hasDefine("HAS_TEXTURE_DIFFUSE"))shader.define("HAS_TEXTURE_DIFFUSE");
        if (!diffuseTextureUniform)diffuseTextureUniform = new CGL.Uniform(shader, "t", "texDiffuse");
    }
    else
    {
        shader.removeUniform("texDiffuse");
        shader.removeDefine("HAS_TEXTURE_DIFFUSE");
        diffuseTextureUniform = null;
    }
    updateUi();
}

function updateUi()
{
    const hasTexture = diffuseTexture.isLinked() || textureOpacity.isLinked();
    diffuseRepeatX.setUiAttribs({ "greyout": !hasTexture });
    diffuseRepeatY.setUiAttribs({ "greyout": !hasTexture });
    diffuseOffsetX.setUiAttribs({ "greyout": !hasTexture });
    diffuseOffsetY.setUiAttribs({ "greyout": !hasTexture });
    colorizeTexture.setUiAttribs({ "greyout": !hasTexture });

    alphaMaskSource.setUiAttribs({ "greyout": !textureOpacity.get() });
    texCoordAlpha.setUiAttribs({ "greyout": !textureOpacity.get() });

    let notUsingColor = true;
    notUsingColor = diffuseTexture.get() && !colorizeTexture.get();
    r.setUiAttribs({ "greyout": notUsingColor });
    g.setUiAttribs({ "greyout": notUsingColor });
    b.setUiAttribs({ "greyout": notUsingColor });
}

function updateDefines()
{
    shader.toggleDefine("VERTEX_COLORS", vertexColors.get());
    shader.toggleDefine("CROP_TEXCOORDS", cropRepeat.get());
    shader.toggleDefine("COLORIZE_TEXTURE", colorizeTexture.get());
    shader.toggleDefine("TRANSFORMALPHATEXCOORDS", texCoordAlpha.get());
    shader.toggleDefine("DISCARDTRANS", discardTransPxl.get());
    shader.toggleDefine("BILLBOARD", doBillboard.get());

    shader.toggleDefine("ALPHA_MASK_ALPHA", alphaMaskSource.get() == "A");
    shader.toggleDefine("ALPHA_MASK_IALPHA", alphaMaskSource.get() == "1-A");
    shader.toggleDefine("ALPHA_MASK_IR", alphaMaskSource.get() == "1-R");
    shader.toggleDefine("ALPHA_MASK_LUMI", alphaMaskSource.get() == "Luminance");
    shader.toggleDefine("ALPHA_MASK_R", alphaMaskSource.get() == "R");
    shader.toggleDefine("ALPHA_MASK_G", alphaMaskSource.get() == "G");
    shader.toggleDefine("ALPHA_MASK_B", alphaMaskSource.get() == "B");
    updateUi();
}

}
};

CABLES.OPS["ec55d252-3843-41b1-b731-0482dbd9e72b"]={f:Ops.Gl.Shader.BasicMaterial_v3,objName:"Ops.Gl.Shader.BasicMaterial_v3"};




// **************************************************************
// 
// Ops.Gl.Matrix.Scale
// 
// **************************************************************

Ops.Gl.Matrix.Scale= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    render = op.inTrigger("render"),
    scale = op.inValueFloat("scale", 1.0),
    scaleX = op.inValueFloat("x", 1),
    scaleY = op.inValueFloat("y", 1),
    scaleZ = op.inValueFloat("z", 1),
    trigger = op.outTrigger("trigger");

op.setPortGroup("Axis", [scaleX, scaleY, scaleZ]);

const vScale = vec3.create();

scaleX.onChange =
    scaleY.onChange =
    scaleZ.onChange =
    scale.onChange = scaleChanged;

scaleChanged();

render.onTriggered = function ()
{
    const cgl = op.patch.cg || op.patch.cgl;
    cgl.pushModelMatrix();
    mat4.scale(cgl.mMatrix, cgl.mMatrix, vScale);
    trigger.trigger();
    cgl.popModelMatrix();
};

function scaleChanged()
{
    const s = scale.get();
    vec3.set(vScale, s * scaleX.get(), s * scaleY.get(), s * scaleZ.get());
}

}
};

CABLES.OPS["50e7f565-0cdb-47ca-912b-87c04e2f00e3"]={f:Ops.Gl.Matrix.Scale,objName:"Ops.Gl.Matrix.Scale"};




// **************************************************************
// 
// Ops.Trigger.RouteTrigger
// 
// **************************************************************

Ops.Trigger.RouteTrigger= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const NUM_PORTS = 24;
const
    exePort = op.inTriggerButton("Execute"),
    switchPort = op.inValueInt("Switch Value"),
    nextTriggerPort = op.outTrigger("Next Trigger"),
    valueOutPort = op.outNumber("Switched Value");

const triggerPorts = [];
exePort.onTriggered = update;

for (let j = 0; j < NUM_PORTS; j++)
{
    triggerPorts[j] = op.outTrigger("Trigger " + j);

    triggerPorts[j].onLinkChanged = countLinks;
}

const
    defaultTriggerPort = op.outTrigger("Default Trigger"),
    outNumConnected = op.outNumber("Highest Index");

function update()
{
    const index = Math.round(switchPort.get());

    if (index >= 0 && index < NUM_PORTS)
    {
        valueOutPort.set(index);
        triggerPorts[index].trigger();
    }
    else
    {
        valueOutPort.set(-1);
        defaultTriggerPort.trigger();
    }
    nextTriggerPort.trigger();
}

function countLinks()
{
    let count = 0;
    for (let i = 0; i < triggerPorts.length; i++)
        if (triggerPorts[i] && triggerPorts[i].isLinked())count = i;

    outNumConnected.set(count);
}

}
};

CABLES.OPS["44ceb5d8-b040-4722-b189-a6fb8172517d"]={f:Ops.Trigger.RouteTrigger,objName:"Ops.Trigger.RouteTrigger"};




// **************************************************************
// 
// Ops.Anim.LFO_v3
// 
// **************************************************************

Ops.Anim.LFO_v3= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    time = op.inValue("Time"),
    speed = op.inFloat("Frequency", 1),
    type = op.inValueSelect("Type", ["sine", "triangle", "ramp up", "ramp down", "square"], "sine"),
    phase = op.inValue("Phase", 0),
    rangeMin = op.inValue("Range Min", -1),
    rangeMax = op.inValue("Range Max", 1),
    result = op.outNumber("Result");

let v = 0;
type.onChange = updateType;

updateType();

const PI2 = Math.PI / 2;

function updateType()
{
    if (type.get() == "sine") time.onChange = sine;
    if (type.get() == "ramp up") time.onChange = rampUp;
    if (type.get() == "ramp down") time.onChange = rampDown;
    if (type.get() == "square") time.onChange = square;
    if (type.get() == "triangle") time.onChange = triangle;
}

function updateTime()
{
    return (time.get() * speed.get()) + phase.get();
}

function square()
{
    let t = updateTime() + 0.5;
    v = t % 2.0;
    if (v <= 1.0)v = -1;
    else v = 1;
    v = CABLES.map(v, -1, 1, rangeMin.get(), rangeMax.get());
    result.set(v);
}

function rampUp()
{
    let t = (updateTime() + 1);
    v = t % 1.0;
    v -= 0.5;
    v *= 2.0;
    v = CABLES.map(v, -1, 1, rangeMin.get(), rangeMax.get());
    result.set(v);
}

function rampDown()
{
    let t = updateTime();
    v = t % 1.0;
    v -= 0.5;
    v *= -2.0;
    v = CABLES.map(v, -1, 1, rangeMin.get(), rangeMax.get());
    result.set(v);
}

function triangle()
{
    let t = updateTime();
    v = t % 2.0;
    if (v > 1) v = 2.0 - v;
    v -= 0.5;
    v *= 2.0;
    v = CABLES.map(v, -1, 1, rangeMin.get(), rangeMax.get());
    result.set(v);
}

function sine()
{
    let t = updateTime() * Math.PI - (PI2);
    v = Math.sin((t));
    v = CABLES.map(v, -1, 1, rangeMin.get(), rangeMax.get());
    result.set(v);
}

}
};

CABLES.OPS["5bdbe26b-dea3-4266-850c-1b66ed29936e"]={f:Ops.Anim.LFO_v3,objName:"Ops.Anim.LFO_v3"};




// **************************************************************
// 
// Ops.Anim.Timer_v2
// 
// **************************************************************

Ops.Anim.Timer_v2= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    inSpeed = op.inValue("Speed", 1),
    playPause = op.inValueBool("Play", true),
    reset = op.inTriggerButton("Reset"),
    inSyncTimeline = op.inValueBool("Sync to timeline", false),
    outTime = op.outNumber("Time");

op.setPortGroup("Controls", [playPause, reset, inSpeed]);

const timer = new CABLES.Timer();
let lastTime = null;
let time = 0;
let syncTimeline = false;

playPause.onChange = setState;
setState();

function setState()
{
    if (playPause.get())
    {
        timer.play();
        op.patch.addOnAnimFrame(op);
    }
    else
    {
        timer.pause();
        op.patch.removeOnAnimFrame(op);
    }
}

reset.onTriggered = doReset;

function doReset()
{
    time = 0;
    lastTime = null;
    timer.setTime(0);
    outTime.set(0);
}

inSyncTimeline.onChange = function ()
{
    syncTimeline = inSyncTimeline.get();
    playPause.setUiAttribs({ "greyout": syncTimeline });
    reset.setUiAttribs({ "greyout": syncTimeline });
};

op.onAnimFrame = function (tt, frameNum, deltaMs)
{
    if (timer.isPlaying())
    {
        if (CABLES.overwriteTime !== undefined)
        {
            outTime.set(CABLES.overwriteTime * inSpeed.get());
        }
        else

        if (syncTimeline)
        {
            outTime.set(tt * inSpeed.get());
        }
        else
        {
            timer.update();

            const timerVal = timer.get();

            if (lastTime === null)
            {
                lastTime = timerVal;
                return;
            }

            const t = Math.abs(timerVal - lastTime);
            lastTime = timerVal;

            time += t * inSpeed.get();
            if (time != time)time = 0;
            outTime.set(time);
        }
    }
};

}
};

CABLES.OPS["aac7f721-208f-411a-adb3-79adae2e471a"]={f:Ops.Anim.Timer_v2,objName:"Ops.Anim.Timer_v2"};




// **************************************************************
// 
// Ops.Graphics.Transform
// 
// **************************************************************

Ops.Graphics.Transform= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    render = op.inTrigger("render"),
    posX = op.inValue("posX", 0),
    posY = op.inValue("posY", 0),
    posZ = op.inValue("posZ", 0),
    scale = op.inValue("scale", 1),
    rotX = op.inValue("rotX", 0),
    rotY = op.inValue("rotY", 0),
    rotZ = op.inValue("rotZ", 0),
    trigger = op.outTrigger("trigger");

op.setPortGroup("Rotation", [rotX, rotY, rotZ]);
op.setPortGroup("Position", [posX, posY, posZ]);
op.setPortGroup("Scale", [scale]);
op.setUiAxisPorts(posX, posY, posZ);

op.toWorkPortsNeedToBeLinked(render, trigger);

const vPos = vec3.create();
const vScale = vec3.create();
const transMatrix = mat4.create();
mat4.identity(transMatrix);

let
    doScale = false,
    doTranslate = false,
    translationChanged = true,
    scaleChanged = true,
    rotChanged = true;

rotX.onChange = rotY.onChange = rotZ.onChange = setRotChanged;
posX.onChange = posY.onChange = posZ.onChange = setTranslateChanged;
scale.onChange = setScaleChanged;

render.onTriggered = function ()
{
    // if(!CGL.TextureEffect.checkOpNotInTextureEffect(op)) return;

    let updateMatrix = false;
    if (translationChanged)
    {
        updateTranslation();
        updateMatrix = true;
    }
    if (scaleChanged)
    {
        updateScale();
        updateMatrix = true;
    }
    if (rotChanged) updateMatrix = true;

    if (updateMatrix) doUpdateMatrix();

    const cg = op.patch.cg || op.patch.cgl;
    cg.pushModelMatrix();
    mat4.multiply(cg.mMatrix, cg.mMatrix, transMatrix);

    trigger.trigger();
    cg.popModelMatrix();

    if (CABLES.UI)
    {
        if (!posX.isLinked() && !posY.isLinked() && !posZ.isLinked())
        {
            gui.setTransform(op.id, posX.get(), posY.get(), posZ.get());

            if (op.isCurrentUiOp())
                gui.setTransformGizmo(
                    {
                        "posX": posX,
                        "posY": posY,
                        "posZ": posZ,
                    });
        }
    }
};

// op.transform3d = function ()
// {
//     return { "pos": [posX, posY, posZ] };
// };

function doUpdateMatrix()
{
    mat4.identity(transMatrix);
    if (doTranslate)mat4.translate(transMatrix, transMatrix, vPos);

    if (rotX.get() !== 0)mat4.rotateX(transMatrix, transMatrix, rotX.get() * CGL.DEG2RAD);
    if (rotY.get() !== 0)mat4.rotateY(transMatrix, transMatrix, rotY.get() * CGL.DEG2RAD);
    if (rotZ.get() !== 0)mat4.rotateZ(transMatrix, transMatrix, rotZ.get() * CGL.DEG2RAD);

    if (doScale)mat4.scale(transMatrix, transMatrix, vScale);
    rotChanged = false;
}

function updateTranslation()
{
    doTranslate = false;
    if (posX.get() !== 0.0 || posY.get() !== 0.0 || posZ.get() !== 0.0) doTranslate = true;
    vec3.set(vPos, posX.get(), posY.get(), posZ.get());
    translationChanged = false;
}

function updateScale()
{
    // doScale=false;
    // if(scale.get()!==0.0)
    doScale = true;
    vec3.set(vScale, scale.get(), scale.get(), scale.get());
    scaleChanged = false;
}

function setTranslateChanged()
{
    translationChanged = true;
}

function setScaleChanged()
{
    scaleChanged = true;
}

function setRotChanged()
{
    rotChanged = true;
}

doUpdateMatrix();

}
};

CABLES.OPS["650baeb1-db2d-4781-9af6-ab4e9d4277be"]={f:Ops.Graphics.Transform,objName:"Ops.Graphics.Transform"};




// **************************************************************
// 
// Ops.Extension.OpenType.OpentypeFont
// 
// **************************************************************

Ops.Extension.OpenType.OpentypeFont= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    filename = op.inUrl("Font File", [".otf", ".ttf", ".woff", ".woff2"]),
    outFont = op.outObject("Opentype Font", null, "opentype");

filename.onChange = async function ()
{
    const fontFile = op.patch.getFilePath(String(filename.get()));

    op.setUiError("exc", null);

    try
    {
        const font = await opentype.load(fontFile);
        outFont.set(font);
    }
    catch(e)
    {
        console.log(e);
        let str=e.toString();
        str=str.replaceAll("<","&lt;");
        str=str.replaceAll(">","&gt;");
        op.setUiError("exc", "opentype error "+str);
    }
};

}
};

CABLES.OPS["f85574bb-3869-4a14-8dcc-70414bd8cfcd"]={f:Ops.Extension.OpenType.OpentypeFont,objName:"Ops.Extension.OpenType.OpentypeFont"};




// **************************************************************
// 
// Ops.Trigger.Sequence
// 
// **************************************************************

Ops.Trigger.Sequence= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    exe = op.inTrigger("exe"),
    cleanup = op.inTriggerButton("Clean up connections");

op.setUiAttrib({ "resizable": true, "resizableY": false, "stretchPorts": true });
const
    exes = [],
    triggers = [],
    num = 16;

let
    updateTimeout = null,
    connectedOuts = [];

exe.onTriggered = triggerAll;
cleanup.onTriggered = clean;
cleanup.setUiAttribs({ "hideParam": true, "hidePort": true });

for (let i = 0; i < num; i++)
{
    const p = op.outTrigger("trigger " + i);
    triggers.push(p);
    p.onLinkChanged = updateButton;

    if (i < num - 1)
    {
        let newExe = op.inTrigger("exe " + i);
        newExe.onTriggered = triggerAll;
        exes.push(newExe);
    }
}

updateConnected();

function updateConnected()
{
    connectedOuts.length = 0;
    for (let i = 0; i < triggers.length; i++)
        if (triggers[i].links.length > 0) connectedOuts.push(triggers[i]);
}

function updateButton()
{
    updateConnected();
    clearTimeout(updateTimeout);
    updateTimeout = setTimeout(() =>
    {
        let show = false;
        for (let i = 0; i < triggers.length; i++)
            if (triggers[i].links.length > 1) show = true;

        cleanup.setUiAttribs({ "hideParam": !show });

        if (op.isCurrentUiOp()) op.refreshParams();
    }, 60);
}

function triggerAll()
{
    // for (let i = 0; i < triggers.length; i++) triggers[i].trigger();
    for (let i = 0; i < connectedOuts.length; i++) connectedOuts[i].trigger();
}

function clean()
{
    let count = 0;
    for (let i = 0; i < triggers.length; i++)
    {
        let removeLinks = [];

        if (triggers[i].links.length > 1)
            for (let j = 1; j < triggers[i].links.length; j++)
            {
                while (triggers[count].links.length > 0) count++;

                removeLinks.push(triggers[i].links[j]);
                const otherPort = triggers[i].links[j].getOtherPort(triggers[i]);
                op.patch.link(op, "trigger " + count, otherPort.op, otherPort.name);
                count++;
            }

        for (let j = 0; j < removeLinks.length; j++) removeLinks[j].remove();
    }
    updateButton();
    updateConnected();
}

}
};

CABLES.OPS["a466bc1f-06e9-4595-8849-bffb9fe22f99"]={f:Ops.Trigger.Sequence,objName:"Ops.Trigger.Sequence"};




// **************************************************************
// 
// Ops.Gl.Phong.PhongMaterial_v6
// 
// **************************************************************

Ops.Gl.Phong.PhongMaterial_v6= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={"phong_frag":"IN vec3 viewDirection;\r\nIN vec3 normInterpolated;\r\nIN vec2 texCoord;\r\n\r\n#ifdef AO_CHAN_1\r\n    #ifndef ATTRIB_texCoord1\r\n        #define ATTRIB_texCoord1\r\n\r\n        IN vec2 texCoord1;\r\n    #endif\r\n#endif\r\n\r\n#ifdef HAS_TEXTURE_AO\r\nvec2 tcAo;\r\n#endif\r\n\r\n\r\n\r\n#ifdef ENABLE_FRESNEL\r\n    IN vec4 cameraSpace_pos;\r\n#endif\r\n\r\n// IN mat3 normalMatrix; // when instancing...\r\n\r\n#ifdef HAS_TEXTURE_NORMAL\r\n    IN mat3 TBN_Matrix; // tangent bitangent normal space transform matrix\r\n#endif\r\n\r\nIN vec3 fragPos;\r\nIN vec3 v_viewDirection;\r\n\r\nUNI vec4 inDiffuseColor;\r\nUNI vec4 inMaterialProperties;\r\n\r\n#ifdef ADD_EMISSIVE_COLOR\r\n    UNI vec4 inEmissiveColor; // .w = intensity\r\n#endif\r\n\r\n#ifdef ENABLE_FRESNEL\r\n    UNI mat4 viewMatrix;\r\n    UNI vec4 inFresnel;\r\n    UNI vec2 inFresnelWidthExponent;\r\n#endif\r\n\r\n#ifdef ENVMAP_MATCAP\r\n    IN vec3 viewSpaceNormal;\r\n    IN vec3 viewSpacePosition;\r\n#endif\r\n\r\nstruct Light {\r\n    vec3 color;\r\n    vec3 position;\r\n    vec3 specular;\r\n\r\n\r\n    // * SPOT LIGHT * //\r\n    #ifdef HAS_SPOT\r\n        vec3 conePointAt;\r\n        #define COSCONEANGLE x\r\n        #define COSCONEANGLEINNER y\r\n        #define SPOTEXPONENT z\r\n        vec3 spotProperties;\r\n    #endif\r\n\r\n    #define INTENSITY x\r\n    #define ATTENUATION y\r\n    #define FALLOFF z\r\n    #define RADIUS w\r\n    vec4 lightProperties;\r\n\r\n    int castLight;\r\n};\r\n\r\n/* CONSTANTS */\r\n#define NONE -1\r\n#define ALBEDO x\r\n#define ROUGHNESS y\r\n#define SHININESS z\r\n#define SPECULAR_AMT w\r\n#define NORMAL x\r\n#define AO y\r\n#define SPECULAR z\r\n#define EMISSIVE w\r\nconst float PI = 3.1415926535897932384626433832795;\r\nconst float TWO_PI = (2. * PI);\r\nconst float EIGHT_PI = (8. * PI);\r\n\r\n#define RECIPROCAL_PI 1./PI\r\n#define RECIPROCAL_PI2 RECIPROCAL_PI/2.\r\n\r\n// TEXTURES\r\n// #ifdef HAS_TEXTURES\r\n    UNI vec4 inTextureIntensities;\r\n\r\n    #ifdef HAS_TEXTURE_ENV\r\n        #ifdef TEX_FORMAT_CUBEMAP\r\n            UNI samplerCube texEnv;\r\n            #ifndef WEBGL1\r\n                #define SAMPLETEX textureLod\r\n            #endif\r\n            #ifdef WEBGL1\r\n                #define SAMPLETEX textureCubeLodEXT\r\n            #endif\r\n        #endif\r\n\r\n        #ifdef TEX_FORMAT_EQUIRECT\r\n            UNI sampler2D texEnv;\r\n            #ifdef WEBGL1\r\n                // #extension GL_EXT_shader_texture_lod : enable\r\n                #ifdef GL_EXT_shader_texture_lod\r\n                    #define textureLod texture2DLodEXT\r\n                #endif\r\n                // #define textureLod texture2D\r\n            #endif\r\n\r\n            #define SAMPLETEX sampleEquirect\r\n\r\n            const vec2 invAtan = vec2(0.1591, 0.3183);\r\n            vec4 sampleEquirect(sampler2D tex,vec3 direction,float lod)\r\n            {\r\n                #ifndef WEBGL1\r\n                    vec3 newDirection = normalize(direction);\r\n            \t\tvec2 sampleUV;\r\n            \t\tsampleUV.x = -1. * (atan( direction.z, direction.x ) * RECIPROCAL_PI2 + 0.75);\r\n            \t\tsampleUV.y = asin( clamp(direction.y, -1., 1.) ) * RECIPROCAL_PI + 0.5;\r\n                #endif\r\n\r\n                #ifdef WEBGL1\r\n                    vec3 newDirection = normalize(direction);\r\n                \t\tvec2 sampleUV = vec2(atan(newDirection.z, newDirection.x), asin(newDirection.y+1e-6));\r\n                        sampleUV *= vec2(0.1591, 0.3183);\r\n                        sampleUV += 0.5;\r\n                #endif\r\n                return textureLod(tex, sampleUV, lod);\r\n            }\r\n        #endif\r\n        #ifdef ENVMAP_MATCAP\r\n            UNI sampler2D texEnv;\r\n            #ifdef WEBGL1\r\n                // #extension GL_EXT_shader_texture_lod : enable\r\n                #ifdef GL_EXT_shader_texture_lod\r\n                    #define textureLod texture2DLodEXT\r\n                #endif\r\n                // #define textureLod texture2D\r\n            #endif\r\n\r\n\r\n            // * taken & modified from https://github.com/mrdoob/three.js/blob/dev/src/renderers/shaders/ShaderLib/meshmatcap_frag.glsl.js\r\n            vec2 getMatCapUV(vec3 viewSpacePosition, vec3 viewSpaceNormal) {\r\n                vec3 viewDir = normalize(-viewSpacePosition);\r\n            \tvec3 x = normalize(vec3(viewDir.z, 0.0, - viewDir.x));\r\n            \tvec3 y = normalize(cross(viewDir, x));\r\n            \tvec2 uv = vec2(dot(x, viewSpaceNormal), dot(y, viewSpaceNormal)) * 0.495 + 0.5; // 0.495 to remove artifacts caused by undersized matcap disks\r\n            \treturn uv;\r\n            }\r\n        #endif\r\n\r\n        UNI float inEnvMapIntensity;\r\n        UNI float inEnvMapWidth;\r\n    #endif\r\n\r\n    #ifdef HAS_TEXTURE_LUMINANCE_MASK\r\n        UNI sampler2D texLuminance;\r\n        UNI float inLuminanceMaskIntensity;\r\n    #endif\r\n\r\n    #ifdef HAS_TEXTURE_DIFFUSE\r\n        UNI sampler2D texDiffuse;\r\n    #endif\r\n\r\n    #ifdef HAS_TEXTURE_SPECULAR\r\n        UNI sampler2D texSpecular;\r\n    #endif\r\n\r\n    #ifdef HAS_TEXTURE_NORMAL\r\n        UNI sampler2D texNormal;\r\n    #endif\r\n\r\n    #ifdef HAS_TEXTURE_AO\r\n        UNI sampler2D texAO;\r\n    #endif\r\n\r\n    #ifdef HAS_TEXTURE_EMISSIVE\r\n        UNI sampler2D texEmissive;\r\n    #endif\r\n\r\n    #ifdef HAS_TEXTURE_EMISSIVE_MASK\r\n        UNI sampler2D texMaskEmissive;\r\n        UNI float inEmissiveMaskIntensity;\r\n    #endif\r\n    #ifdef HAS_TEXTURE_ALPHA\r\n        UNI sampler2D texAlpha;\r\n    #endif\r\n// #endif\r\n\r\n{{MODULES_HEAD}}\r\n\r\nfloat when_gt(float x, float y) { return max(sign(x - y), 0.0); } // comparator function\r\nfloat when_lt(float x, float y) { return max(sign(y - x), 0.0); }\r\nfloat when_eq(float x, float y) { return 1. - abs(sign(x - y)); } // comparator function\r\nfloat when_neq(float x, float y) { return abs(sign(x - y)); } // comparator function\r\nfloat when_ge(float x, float y) { return 1.0 - when_lt(x, y); }\r\nfloat when_le(float x, float y) { return 1.0 - when_gt(x, y); }\r\n\r\n#ifdef FALLOFF_MODE_A\r\n    float CalculateFalloff(float distance, vec3 lightDirection, float falloff, float radius) {\r\n        // * original falloff\r\n        float denom = distance / radius + 1.0;\r\n        float attenuation = 1.0 / (denom*denom);\r\n        float t = (attenuation - falloff) / (1.0 - falloff);\r\n        return max(t, 0.0);\r\n    }\r\n#endif\r\n\r\n#ifdef FALLOFF_MODE_B\r\n    float CalculateFalloff(float distance, vec3 lightDirection, float falloff, float radius) {\r\n        float distanceSquared = dot(lightDirection, lightDirection);\r\n        float factor = distanceSquared * falloff;\r\n        float smoothFactor = clamp(1. - factor * factor, 0., 1.);\r\n        float attenuation = smoothFactor * smoothFactor;\r\n\r\n        return attenuation * 1. / max(distanceSquared, 0.00001);\r\n    }\r\n#endif\r\n\r\n#ifdef FALLOFF_MODE_C\r\n    float CalculateFalloff(float distance, vec3 lightDirection, float falloff, float radius) {\r\n        // https://blog.selfshadow.com/publications/s2013-shading-course/karis/s2013_pbs_epic_notes_v2.pdf\r\n        float falloffNumerator = 1. - pow(distance/radius, 4.);\r\n        falloffNumerator = clamp(falloffNumerator, 0., 1.);\r\n        falloffNumerator *= falloffNumerator;\r\n\r\n        float denominator = distance*distance + falloff;\r\n\r\n        return falloffNumerator/denominator;\r\n    }\r\n#endif\r\n\r\n#ifdef FALLOFF_MODE_D\r\n    float CalculateFalloff(float distance, vec3 lightDirection, float falloff, float radius) {\r\n        // inverse square falloff, \"physically correct\"\r\n        return 1.0 / max(distance * distance, 0.0001);\r\n    }\r\n#endif\r\n\r\n#ifdef ENABLE_FRESNEL\r\n    float CalculateFresnel(vec3 direction, vec3 normal)\r\n    {\r\n        vec3 nDirection = normalize( direction );\r\n        vec3 nNormal = normalize( mat3(viewMatrix) * normal );\r\n        vec3 halfDirection = normalize( nNormal + nDirection );\r\n\r\n        float cosine = dot( halfDirection, nDirection );\r\n        float product = max( cosine, 0.0 );\r\n        float factor = pow(product, inFresnelWidthExponent.y);\r\n\r\n        return 5. * factor;\r\n    }\r\n#endif\r\n\r\n#ifdef CONSERVE_ENERGY\r\n    // http://www.rorydriscoll.com/2009/01/25/energy-conservation-in-games/\r\n    // http://www.farbrausch.de/~fg/articles/phong.pdf\r\n    float EnergyConservation(float shininess) {\r\n        #ifdef SPECULAR_PHONG\r\n            return (shininess + 2.)/TWO_PI;\r\n        #endif\r\n        #ifdef SPECULAR_BLINN\r\n            return (shininess + 8.)/EIGHT_PI;\r\n        #endif\r\n\r\n        #ifdef SPECULAR_SCHLICK\r\n            return (shininess + 8.)/EIGHT_PI;\r\n        #endif\r\n\r\n        #ifdef SPECULAR_GAUSS\r\n            return (shininess + 8.)/EIGHT_PI;\r\n        #endif\r\n    }\r\n#endif\r\n\r\n#ifdef ENABLE_OREN_NAYAR_DIFFUSE\r\n    float CalculateOrenNayar(vec3 lightDirection, vec3 viewDirection, vec3 normal) {\r\n        float LdotV = dot(lightDirection, viewDirection);\r\n        float NdotL = dot(lightDirection, normal);\r\n        float NdotV = dot(normal, viewDirection);\r\n\r\n        float albedo = inMaterialProperties.ALBEDO;\r\n        albedo *= 1.8;\r\n        float s = LdotV - NdotL * NdotV;\r\n        float t = mix(1., max(NdotL, NdotV), step(0., s));\r\n\r\n        float roughness = inMaterialProperties.ROUGHNESS;\r\n        float sigma2 = roughness * roughness;\r\n        float A = 1. + sigma2 * (albedo / (sigma2 + 0.13) + 0.5 / (sigma2 + 0.33));\r\n        float B = 0.45 * sigma2 / (sigma2 + 0.09);\r\n\r\n        float factor = albedo * max(0., NdotL) * (A + B * s / t) / PI;\r\n\r\n        return factor;\r\n\r\n    }\r\n#endif\r\n\r\nvec3 CalculateDiffuseColor(\r\n    vec3 lightDirection,\r\n    vec3 viewDirection,\r\n    vec3 normal,\r\n    vec3 lightColor,\r\n    vec3 materialColor,\r\n    inout float lambert\r\n) {\r\n    #ifndef ENABLE_OREN_NAYAR_DIFFUSE\r\n        lambert = clamp(dot(lightDirection, normal), 0., 1.);\r\n    #endif\r\n\r\n    #ifdef ENABLE_OREN_NAYAR_DIFFUSE\r\n        lambert = CalculateOrenNayar(lightDirection, viewDirection, normal);\r\n    #endif\r\n\r\n    vec3 diffuseColor = lambert * lightColor * materialColor;\r\n    return diffuseColor;\r\n}\r\n\r\nvec3 CalculateSpecularColor(\r\n    vec3 specularColor,\r\n    float specularCoefficient,\r\n    float shininess,\r\n    vec3 lightDirection,\r\n    vec3 viewDirection,\r\n    vec3 normal,\r\n    float lambertian\r\n) {\r\n    vec3 resultColor = vec3(0.);\r\n\r\n    #ifdef SPECULAR_PHONG\r\n        vec3 reflectDirection = reflect(-lightDirection, normal);\r\n        float specularAngle = max(dot(reflectDirection, viewDirection), 0.);\r\n        float specularFactor = pow(specularAngle, max(0., shininess));\r\n    resultColor = lambertian * specularFactor * specularCoefficient * specularColor;\r\n    #endif\r\n\r\n    #ifdef SPECULAR_BLINN\r\n        vec3 halfDirection = normalize(lightDirection + viewDirection);\r\n        float specularAngle = max(dot(halfDirection, normal), 0.);\r\n        float specularFactor = pow(specularAngle, max(0., shininess));\r\n        resultColor = lambertian * specularFactor * specularCoefficient * specularColor;\r\n    #endif\r\n\r\n    #ifdef SPECULAR_SCHLICK\r\n        vec3 halfDirection = normalize(lightDirection + viewDirection);\r\n        float specularAngle = dot(halfDirection, normal);\r\n        float schlickShininess = max(0., shininess);\r\n        float specularFactor = specularAngle / (schlickShininess - schlickShininess*specularAngle + specularAngle);\r\n        resultColor = lambertian * specularFactor * specularCoefficient * specularColor;\r\n    #endif\r\n\r\n    #ifdef SPECULAR_GAUSS\r\n        vec3 halfDirection = normalize(lightDirection + viewDirection);\r\n        float specularAngle = acos(max(dot(halfDirection, normal), 0.));\r\n        float exponent = specularAngle * shininess * 0.17;\r\n        exponent = -(exponent*exponent);\r\n        float specularFactor = exp(exponent);\r\n\r\n        resultColor = lambertian * specularFactor * specularCoefficient * specularColor;\r\n    #endif\r\n\r\n    #ifdef CONSERVE_ENERGY\r\n        float conserveEnergyFactor = EnergyConservation(shininess);\r\n        resultColor = conserveEnergyFactor * resultColor;\r\n    #endif\r\n\r\n    return resultColor;\r\n}\r\n\r\n#ifdef HAS_SPOT\r\n    float CalculateSpotLightEffect(vec3 lightPosition, vec3 conePointAt, float cosConeAngle, float cosConeAngleInner, float spotExponent, vec3 lightDirection) {\r\n        vec3 spotLightDirection = normalize(lightPosition-conePointAt);\r\n        float spotAngle = dot(-lightDirection, spotLightDirection);\r\n        float epsilon = cosConeAngle - cosConeAngleInner;\r\n\r\n        float spotIntensity = clamp((spotAngle - cosConeAngle)/epsilon, 0.0, 1.0);\r\n        spotIntensity = pow(spotIntensity, max(0.01, spotExponent));\r\n\r\n        return max(0., spotIntensity);\r\n    }\r\n#endif\r\n\r\n\r\n\r\n{{PHONG_FRAGMENT_HEAD}}\r\n\r\n\r\nvoid main()\r\n{\r\n    {{MODULE_BEGIN_FRAG}}\r\n\r\n    vec4 col=vec4(0., 0., 0., inDiffuseColor.a);\r\n    vec3 calculatedColor = vec3(0.);\r\n    vec3 normal = normalize(normInterpolated);\r\n    vec3 baseColor = inDiffuseColor.rgb;\r\n\r\n    {{MODULE_BASE_COLOR}}\r\n\r\n\r\n\r\n    #ifdef AO_CHAN_0\r\n        vec2 tcAo=texCoord;\r\n    #endif\r\n    #ifdef AO_CHAN_1\r\n        vec2 tcAo=texCoord1;\r\n    #endif\r\n\r\n\r\n    vec3 viewDirection = normalize(v_viewDirection);\r\n\r\n    #ifdef DOUBLE_SIDED\r\n        if(!gl_FrontFacing) normal = normal * -1.0;\r\n    #endif\r\n\r\n    #ifdef HAS_TEXTURES\r\n        #ifdef HAS_TEXTURE_DIFFUSE\r\n            baseColor = texture(texDiffuse, texCoord).rgb;\r\n\r\n            #ifdef COLORIZE_TEXTURE\r\n                baseColor *= inDiffuseColor.rgb;\r\n            #endif\r\n        #endif\r\n\r\n        #ifdef HAS_TEXTURE_NORMAL\r\n            normal = texture(texNormal, texCoord).rgb;\r\n            normal = normalize(normal * 2. - 1.);\r\n            float normalIntensity = inTextureIntensities.NORMAL;\r\n            normal = normalize(mix(vec3(0., 0., 1.), normal, 2. * normalIntensity));\r\n            normal = normalize(TBN_Matrix * normal);\r\n        #endif\r\n    #endif\r\n\r\n    {{PHONG_FRAGMENT_BODY}}\r\n\r\n\r\n\r\n\r\n\r\n\r\n    #ifdef ENABLE_FRESNEL\r\n        calculatedColor += inFresnel.rgb * (CalculateFresnel(vec3(cameraSpace_pos), normal) * inFresnel.w * inFresnelWidthExponent.x);\r\n    #endif\r\n\r\n     #ifdef HAS_TEXTURE_ALPHA\r\n        #ifdef ALPHA_MASK_ALPHA\r\n            col.a*=texture(texAlpha,texCoord).a;\r\n        #endif\r\n        #ifdef ALPHA_MASK_LUMI\r\n            col.a*= dot(vec3(0.2126,0.7152,0.0722), texture(texAlpha,texCoord).rgb);\r\n        #endif\r\n        #ifdef ALPHA_MASK_R\r\n            col.a*=texture(texAlpha,texCoord).r;\r\n        #endif\r\n        #ifdef ALPHA_MASK_G\r\n            col.a*=texture(texAlpha,texCoord).g;\r\n        #endif\r\n        #ifdef ALPHA_MASK_B\r\n            col.a*=texture(texAlpha,texCoord).b;\r\n        #endif\r\n    #endif\r\n\r\n    #ifdef DISCARDTRANS\r\n        if(col.a<0.2) discard;\r\n    #endif\r\n\r\n\r\n    #ifdef HAS_TEXTURE_ENV\r\n        vec3 luminanceColor = vec3(0.);\r\n\r\n        #ifndef ENVMAP_MATCAP\r\n            float environmentMapWidth = inEnvMapWidth;\r\n            float glossyExponent = inMaterialProperties.SHININESS;\r\n            float glossyCoefficient = inMaterialProperties.SPECULAR_AMT;\r\n\r\n            vec3 envMapNormal =  normal;\r\n            vec3 reflectDirection = reflect(normalize(-viewDirection), normal);\r\n\r\n            float lambertianCoefficient = dot(viewDirection, reflectDirection); //0.44; // TODO: need prefiltered map for this\r\n            // lambertianCoefficient = 1.;\r\n            float specularAngle = max(dot(reflectDirection, viewDirection), 0.);\r\n            float specularFactor = pow(specularAngle, max(0., inMaterialProperties.SHININESS));\r\n\r\n            glossyExponent = specularFactor;\r\n\r\n            float maxMIPLevel = 10.;\r\n            float MIPlevel = log2(environmentMapWidth / 1024. * sqrt(3.)) - 0.5 * log2(glossyExponent + 1.);\r\n\r\n            luminanceColor = inEnvMapIntensity * (\r\n                inDiffuseColor.rgb *\r\n                SAMPLETEX(texEnv, envMapNormal, maxMIPLevel).rgb\r\n                +\r\n                glossyCoefficient * SAMPLETEX(texEnv, reflectDirection, MIPlevel).rgb\r\n            );\r\n        #endif\r\n        #ifdef ENVMAP_MATCAP\r\n            luminanceColor = inEnvMapIntensity * (\r\n                texture(texEnv, getMatCapUV(viewSpacePosition, viewSpaceNormal)).rgb\r\n                //inDiffuseColor.rgb\r\n                //* textureLod(texEnv, getMatCapUV(envMapNormal), maxMIPLevel).rgb\r\n                //+\r\n                //glossyCoefficient * textureLod(texEnv, getMatCapUV(reflectDirection), MIPlevel).rgb\r\n            );\r\n        #endif\r\n\r\n\r\n\r\n        #ifdef HAS_TEXTURE_LUMINANCE_MASK\r\n            luminanceColor *= texture(texLuminance, texCoord).r * inLuminanceMaskIntensity;\r\n        #endif\r\n\r\n        #ifdef HAS_TEXTURE_AO\r\n            luminanceColor *= texture(texAO, tcAo).r*inTextureIntensities.AO;\r\n        #endif\r\n\r\n        #ifdef ENV_BLEND_ADD\r\n            calculatedColor.rgb += luminanceColor;\r\n        #endif\r\n        #ifdef ENV_BLEND_MUL\r\n            calculatedColor.rgb *= luminanceColor;\r\n        #endif\r\n\r\n        #ifdef ENV_BLEND_MIX\r\n            calculatedColor.rgb=mix(luminanceColor,calculatedColor.rgb,luminanceColor);\r\n        #endif\r\n\r\n\r\n    #endif\r\n\r\n    #ifdef ADD_EMISSIVE_COLOR\r\n        vec3 emissiveRadiance = mix(calculatedColor, inEmissiveColor.rgb, inEmissiveColor.w); // .w = intensity of color;\r\n\r\n        #ifdef HAS_TEXTURE_EMISSIVE\r\n            float emissiveIntensity = inTextureIntensities.EMISSIVE;\r\n            emissiveRadiance = mix(calculatedColor, texture(texEmissive, texCoord).rgb, emissiveIntensity);\r\n        #endif\r\n\r\n        #ifdef HAS_TEXTURE_EMISSIVE_MASK\r\n           float emissiveMixValue = mix(1., texture(texMaskEmissive, texCoord).r, inEmissiveMaskIntensity);\r\n           calculatedColor = mix(calculatedColor, emissiveRadiance, emissiveMixValue);\r\n        #endif\r\n\r\n        #ifndef HAS_TEXTURE_EMISSIVE_MASK\r\n            calculatedColor = emissiveRadiance;\r\n        #endif\r\n    #endif\r\n\r\n    col.rgb = clamp(calculatedColor, 0., 1.);\r\n\r\n\r\n    {{MODULE_COLOR}}\r\n\r\n    outColor = col;\r\n\r\n}\r\n","phong_vert":"\r\n{{MODULES_HEAD}}\r\n\r\n#define NONE -1\r\n#define AMBIENT 0\r\n#define POINT 1\r\n#define DIRECTIONAL 2\r\n#define SPOT 3\r\n\r\n#define TEX_REPEAT_X x;\r\n#define TEX_REPEAT_Y y;\r\n#define TEX_OFFSET_X z;\r\n#define TEX_OFFSET_Y w;\r\n\r\nIN vec3 vPosition;\r\nIN vec2 attrTexCoord;\r\nIN vec3 attrVertNormal;\r\nIN float attrVertIndex;\r\nIN vec3 attrTangent;\r\nIN vec3 attrBiTangent;\r\n\r\nOUT vec2 texCoord;\r\nOUT vec3 normInterpolated;\r\nOUT vec3 fragPos;\r\n\r\n#ifdef AO_CHAN_1\r\n    #ifndef ATTRIB_attrTexCoord1\r\n        IN vec2 attrTexCoord1;\r\n        OUT vec2 texCoord1;\r\n        #define ATTRIB_attrTexCoord1\r\n        #define ATTRIB_texCoord1\r\n    #endif\r\n#endif\r\n\r\n#ifdef HAS_TEXTURE_NORMAL\r\n    OUT mat3 TBN_Matrix; // tangent bitangent normal space transform matrix\r\n#endif\r\n\r\n#ifdef ENABLE_FRESNEL\r\n    OUT vec4 cameraSpace_pos;\r\n#endif\r\n\r\nOUT vec3 v_viewDirection;\r\nOUT mat3 normalMatrix;\r\nOUT mat4 mvMatrix;\r\n\r\n#ifdef HAS_TEXTURES\r\n    UNI vec4 inTextureRepeatOffset;\r\n#endif\r\n\r\nUNI vec3 camPos;\r\nUNI mat4 projMatrix;\r\nUNI mat4 viewMatrix;\r\nUNI mat4 modelMatrix;\r\n\r\n#ifdef ENVMAP_MATCAP\r\n    OUT vec3 viewSpaceNormal;\r\n    OUT vec3 viewSpacePosition;\r\n#endif\r\n\r\n\r\nmat3 transposeMat3(mat3 m)\r\n{\r\n    return mat3(m[0][0], m[1][0], m[2][0],\r\n        m[0][1], m[1][1], m[2][1],\r\n        m[0][2], m[1][2], m[2][2]);\r\n}\r\n\r\nmat3 inverseMat3(mat3 m)\r\n{\r\n    float a00 = m[0][0], a01 = m[0][1], a02 = m[0][2];\r\n    float a10 = m[1][0], a11 = m[1][1], a12 = m[1][2];\r\n    float a20 = m[2][0], a21 = m[2][1], a22 = m[2][2];\r\n\r\n    float b01 = a22 * a11 - a12 * a21;\r\n    float b11 = -a22 * a10 + a12 * a20;\r\n    float b21 = a21 * a10 - a11 * a20;\r\n\r\n    float det = a00 * b01 + a01 * b11 + a02 * b21;\r\n\r\n    return mat3(b01, (-a22 * a01 + a02 * a21), (a12 * a01 - a02 * a11),\r\n        b11, (a22 * a00 - a02 * a20), (-a12 * a00 + a02 * a10),\r\n        b21, (-a21 * a00 + a01 * a20), (a11 * a00 - a01 * a10)) / det;\r\n}\r\n\r\nvoid main()\r\n{\r\n    mat4 mMatrix=modelMatrix;\r\n    vec4 pos=vec4(vPosition,  1.0);\r\n\r\n    texCoord=attrTexCoord;\r\n    texCoord.y = 1. - texCoord.y;\r\n\r\n    #ifdef ATTRIB_texCoord1\r\n        texCoord1=attrTexCoord1;\r\n    #endif\r\n\r\n    vec3 norm=attrVertNormal;\r\n    vec3 tangent = attrTangent;\r\n    vec3 bitangent = attrBiTangent;\r\n\r\n    {{MODULE_VERTEX_POSITION}}\r\n\r\n    normalMatrix = transposeMat3(inverseMat3(mat3(mMatrix)));\r\n    mvMatrix = (viewMatrix * mMatrix);\r\n\r\n\r\n\r\n    #ifdef ENABLE_FRESNEL\r\n        cameraSpace_pos = mvMatrix * pos;\r\n    #endif\r\n\r\n    #ifdef HAS_TEXTURES\r\n        float repeatX = inTextureRepeatOffset.TEX_REPEAT_X;\r\n        float offsetX = inTextureRepeatOffset.TEX_OFFSET_X;\r\n        float repeatY = inTextureRepeatOffset.TEX_REPEAT_Y;\r\n        float offsetY = inTextureRepeatOffset.TEX_OFFSET_Y;\r\n\r\n        texCoord.x *= repeatX;\r\n        texCoord.x += offsetX;\r\n        texCoord.y *= repeatY;\r\n        texCoord.y += offsetY;\r\n    #endif\r\n\r\n   normInterpolated = vec3(normalMatrix*norm);\r\n\r\n    #ifdef HAS_TEXTURE_NORMAL\r\n        vec3 normCameraSpace = normalize((vec4(normInterpolated, 0.0)).xyz);\r\n        vec3 tangCameraSpace = normalize((mMatrix * vec4(tangent, 0.0)).xyz);\r\n        vec3 bitangCameraSpace = normalize((mMatrix * vec4(bitangent, 0.0)).xyz);\r\n\r\n        // re orthogonalization for smoother normals\r\n        tangCameraSpace = normalize(tangCameraSpace - dot(tangCameraSpace, normCameraSpace) * normCameraSpace);\r\n        bitangCameraSpace = cross(normCameraSpace, tangCameraSpace);\r\n\r\n        TBN_Matrix = mat3(tangCameraSpace, bitangCameraSpace, normCameraSpace);\r\n    #endif\r\n\r\n    fragPos = vec3((mMatrix) * pos);\r\n    v_viewDirection = normalize(camPos - fragPos);\r\n    // modelPos=mMatrix*pos;\r\n\r\n    #ifdef ENVMAP_MATCAP\r\n        mat3 viewSpaceNormalMatrix = normalMatrix = transposeMat3(inverseMat3(mat3(mvMatrix)));\r\n        viewSpaceNormal = normalize(viewSpaceNormalMatrix * norm);\r\n        viewSpacePosition = vec3(mvMatrix * pos);\r\n    #endif\r\n\r\n    mat4 modelViewMatrix=mvMatrix;\r\n    {{MODULE_VERTEX_MODELVIEW}}\r\n\r\n\r\n    gl_Position = projMatrix * modelViewMatrix * pos;\r\n}\r\n","snippet_body_ambient_frag":"    // * AMBIENT LIGHT {{LIGHT_INDEX}} *\r\n    vec3 diffuseColor{{LIGHT_INDEX}} = phongLight{{LIGHT_INDEX}}.lightProperties.INTENSITY*phongLight{{LIGHT_INDEX}}.color;\r\n    calculatedColor += diffuseColor{{LIGHT_INDEX}};\r\n","snippet_body_directional_frag":"    // * DIRECTIONAL LIGHT {{LIGHT_INDEX}} *\r\n\r\n    if (phongLight{{LIGHT_INDEX}}.castLight == 1) {\r\n        vec3 phongLightDirection{{LIGHT_INDEX}} = normalize(phongLight{{LIGHT_INDEX}}.position);\r\n\r\n        float phongLambert{{LIGHT_INDEX}} = 1.; // inout variable\r\n\r\n        vec3 lightColor{{LIGHT_INDEX}} = phongLight{{LIGHT_INDEX}}.color;\r\n        vec3 lightSpecular{{LIGHT_INDEX}} = phongLight{{LIGHT_INDEX}}.specular;\r\n\r\n        #ifdef HAS_TEXTURES\r\n            #ifdef HAS_TEXTURE_AO\r\n                // lightColor{{LIGHT_INDEX}} *= mix(vec3(1.), texture(texAO, texCoord).rgb, inTextureIntensities.AO);\r\n                lightColor{{LIGHT_INDEX}} *= texture(texAO, tcAo).g, inTextureIntensities.AO;\r\n\r\n            #endif\r\n\r\n            #ifdef HAS_TEXTURE_SPECULAR\r\n                lightSpecular{{LIGHT_INDEX}} *= mix(1., texture(texSpecular, texCoord).r, inTextureIntensities.SPECULAR);\r\n            #endif\r\n        #endif\r\n\r\n        vec3 diffuseColor{{LIGHT_INDEX}} = CalculateDiffuseColor(phongLightDirection{{LIGHT_INDEX}}, viewDirection, normal, lightColor{{LIGHT_INDEX}}, baseColor, phongLambert{{LIGHT_INDEX}});\r\n        vec3 specularColor{{LIGHT_INDEX}} = CalculateSpecularColor(\r\n            lightSpecular{{LIGHT_INDEX}},\r\n            inMaterialProperties.SPECULAR_AMT,\r\n            inMaterialProperties.SHININESS,\r\n            phongLightDirection{{LIGHT_INDEX}},\r\n            viewDirection,\r\n            normal,\r\n            phongLambert{{LIGHT_INDEX}}\r\n        );\r\n\r\n        vec3 combinedColor{{LIGHT_INDEX}} = (diffuseColor{{LIGHT_INDEX}} + specularColor{{LIGHT_INDEX}});\r\n\r\n        vec3 lightModelDiff{{LIGHT_INDEX}} = phongLight{{LIGHT_INDEX}}.position - fragPos.xyz;\r\n\r\n        combinedColor{{LIGHT_INDEX}} *= phongLight{{LIGHT_INDEX}}.lightProperties.INTENSITY;\r\n        calculatedColor += combinedColor{{LIGHT_INDEX}};\r\n    }","snippet_body_point_frag":"// * POINT LIGHT {{LIGHT_INDEX}} *\r\n    if (phongLight{{LIGHT_INDEX}}.castLight == 1) {\r\n        vec3 phongLightDirection{{LIGHT_INDEX}} = phongLight{{LIGHT_INDEX}}.position - fragPos.xyz;\r\n        // * get length before normalization for falloff calculation\r\n        phongLightDirection{{LIGHT_INDEX}} = normalize(phongLightDirection{{LIGHT_INDEX}});\r\n        float phongLightDistance{{LIGHT_INDEX}} = length(phongLightDirection{{LIGHT_INDEX}});\r\n\r\n        float phongLambert{{LIGHT_INDEX}} = 1.; // inout variable\r\n\r\n        vec3 lightColor{{LIGHT_INDEX}} = phongLight{{LIGHT_INDEX}}.color;\r\n        vec3 lightSpecular{{LIGHT_INDEX}} = phongLight{{LIGHT_INDEX}}.specular;\r\n\r\n        #ifdef HAS_TEXTURES\r\n            #ifdef HAS_TEXTURE_AO\r\n                lightColor{{LIGHT_INDEX}} -= (1.0-texture(texAO, tcAo).g)* (inTextureIntensities.AO);\r\n            #endif\r\n\r\n            #ifdef HAS_TEXTURE_SPECULAR\r\n                lightSpecular{{LIGHT_INDEX}} *= mix(1., texture(texSpecular, texCoord).r, inTextureIntensities.SPECULAR);\r\n            #endif\r\n        #endif\r\n\r\n        vec3 diffuseColor{{LIGHT_INDEX}} = CalculateDiffuseColor(phongLightDirection{{LIGHT_INDEX}}, viewDirection, normal, lightColor{{LIGHT_INDEX}}, baseColor, phongLambert{{LIGHT_INDEX}});\r\n        vec3 specularColor{{LIGHT_INDEX}} = CalculateSpecularColor(\r\n            lightSpecular{{LIGHT_INDEX}},\r\n            inMaterialProperties.SPECULAR_AMT,\r\n            inMaterialProperties.SHININESS,\r\n            phongLightDirection{{LIGHT_INDEX}},\r\n            viewDirection,\r\n            normal,\r\n            phongLambert{{LIGHT_INDEX}}\r\n        );\r\n\r\n        vec3 combinedColor{{LIGHT_INDEX}} = (diffuseColor{{LIGHT_INDEX}} + specularColor{{LIGHT_INDEX}});\r\n\r\n        combinedColor{{LIGHT_INDEX}} *= phongLight{{LIGHT_INDEX}}.lightProperties.INTENSITY;\r\n\r\n        float attenuation{{LIGHT_INDEX}} = CalculateFalloff(\r\n            phongLightDistance{{LIGHT_INDEX}},\r\n            phongLightDirection{{LIGHT_INDEX}},\r\n            phongLight{{LIGHT_INDEX}}.lightProperties.FALLOFF,\r\n            phongLight{{LIGHT_INDEX}}.lightProperties.RADIUS\r\n        );\r\n\r\n        attenuation{{LIGHT_INDEX}} *= when_gt(phongLambert{{LIGHT_INDEX}}, 0.);\r\n        combinedColor{{LIGHT_INDEX}} *= attenuation{{LIGHT_INDEX}};\r\n\r\n        calculatedColor += combinedColor{{LIGHT_INDEX}};\r\n    }\r\n","snippet_body_spot_frag":"    // * SPOT LIGHT {{LIGHT_INDEX}} *\r\n    if (phongLight{{LIGHT_INDEX}}.castLight == 1) {\r\n        vec3 phongLightDirection{{LIGHT_INDEX}} = phongLight{{LIGHT_INDEX}}.position - fragPos.xyz;\r\n        phongLightDirection{{LIGHT_INDEX}} = normalize( phongLightDirection{{LIGHT_INDEX}});\r\n        float phongLightDistance{{LIGHT_INDEX}} = length(phongLightDirection{{LIGHT_INDEX}});\r\n\r\n        float phongLambert{{LIGHT_INDEX}} = 1.; // inout variable\r\n\r\n        vec3 lightColor{{LIGHT_INDEX}} = phongLight{{LIGHT_INDEX}}.color;\r\n        vec3 lightSpecular{{LIGHT_INDEX}} = phongLight{{LIGHT_INDEX}}.specular;\r\n\r\n        #ifdef HAS_TEXTURES\r\n            #ifdef HAS_TEXTURE_AO\r\n                // lightColor{{LIGHT_INDEX}} *= mix(vec3(1.), texture(texAO, texCoord).rgb, inTextureIntensities.AO);\r\n                lightColor{{LIGHT_INDEX}} *= texture(texAO, texCoord).g, inTextureIntensities.AO;\r\n\r\n            #endif\r\n\r\n            #ifdef HAS_TEXTURE_SPECULAR\r\n                lightSpecular{{LIGHT_INDEX}} *= mix(1., texture(texSpecular, texCoord).r, inTextureIntensities.SPECULAR);\r\n            #endif\r\n        #endif\r\n\r\n        vec3 diffuseColor{{LIGHT_INDEX}} = CalculateDiffuseColor(phongLightDirection{{LIGHT_INDEX}}, viewDirection, normal, lightColor{{LIGHT_INDEX}}, baseColor, phongLambert{{LIGHT_INDEX}});\r\n        vec3 specularColor{{LIGHT_INDEX}} = CalculateSpecularColor(\r\n            lightSpecular{{LIGHT_INDEX}},\r\n            inMaterialProperties.SPECULAR_AMT,\r\n            inMaterialProperties.SHININESS,\r\n            phongLightDirection{{LIGHT_INDEX}},\r\n            viewDirection,\r\n            normal,\r\n            phongLambert{{LIGHT_INDEX}}\r\n        );\r\n\r\n        vec3 combinedColor{{LIGHT_INDEX}} = (diffuseColor{{LIGHT_INDEX}} + specularColor{{LIGHT_INDEX}});\r\n\r\n        float spotIntensity{{LIGHT_INDEX}} = CalculateSpotLightEffect(\r\n            phongLight{{LIGHT_INDEX}}.position, phongLight{{LIGHT_INDEX}}.conePointAt, phongLight{{LIGHT_INDEX}}.spotProperties.COSCONEANGLE,\r\n            phongLight{{LIGHT_INDEX}}.spotProperties.COSCONEANGLEINNER, phongLight{{LIGHT_INDEX}}.spotProperties.SPOTEXPONENT,\r\n            phongLightDirection{{LIGHT_INDEX}}\r\n        );\r\n\r\n        combinedColor{{LIGHT_INDEX}} *= spotIntensity{{LIGHT_INDEX}};\r\n\r\n        vec3 lightModelDiff{{LIGHT_INDEX}} = phongLight{{LIGHT_INDEX}}.position - fragPos.xyz;\r\n\r\n        float attenuation{{LIGHT_INDEX}} = CalculateFalloff(\r\n            phongLightDistance{{LIGHT_INDEX}},\r\n            phongLightDirection{{LIGHT_INDEX}},\r\n            phongLight{{LIGHT_INDEX}}.lightProperties.FALLOFF,\r\n            phongLight{{LIGHT_INDEX}}.lightProperties.RADIUS\r\n        );\r\n\r\n        attenuation{{LIGHT_INDEX}} *= when_gt(phongLambert{{LIGHT_INDEX}}, 0.);\r\n\r\n        combinedColor{{LIGHT_INDEX}} *= attenuation{{LIGHT_INDEX}};\r\n\r\n        combinedColor{{LIGHT_INDEX}} *= phongLight{{LIGHT_INDEX}}.lightProperties.INTENSITY;\r\n        calculatedColor += combinedColor{{LIGHT_INDEX}};\r\n    }","snippet_head_frag":"UNI Light phongLight{{LIGHT_INDEX}};\r\n",};
const cgl = op.patch.cgl;

const attachmentFragmentHead = attachments.snippet_head_frag;
const snippets = {
    "point": attachments.snippet_body_point_frag,
    "spot": attachments.snippet_body_spot_frag,
    "ambient": attachments.snippet_body_ambient_frag,
    "directional": attachments.snippet_body_directional_frag,
    "area": attachments.snippet_body_area_frag,
};
const LIGHT_INDEX_REGEX = new RegExp("{{LIGHT_INDEX}}", "g");

const createFragmentHead = (n) => { return attachmentFragmentHead.replace("{{LIGHT_INDEX}}", n); };
const createFragmentBody = (n, type) => { return snippets[type].replace(LIGHT_INDEX_REGEX, n); };

function createDefaultShader()
{
    const vertexShader = attachments.phong_vert;
    let fragmentShader = attachments.phong_frag;

    let fragmentHead = createFragmentHead(0);
    let fragmentBody = createFragmentBody(0, DEFAULT_LIGHTSTACK[0].type);

    fragmentShader = fragmentShader.replace(FRAGMENT_HEAD_REGEX, fragmentHead);
    fragmentShader = fragmentShader.replace(FRAGMENT_BODY_REGEX, fragmentBody);

    shader.setSource(vertexShader, fragmentShader);
    shader.define("HAS_POINT");
    shader.removeDefine("HAS_SPOT");
    shader.removeDefine("HAS_DIRECTIONAL");
    shader.removeDefine("HAS_AMBIENT");
}

const inTrigger = op.inTrigger("Trigger In");

// * DIFFUSE *
const inDiffuseR = op.inFloat("R", Math.random());
const inDiffuseG = op.inFloat("G", Math.random());
const inDiffuseB = op.inFloat("B", Math.random());
const inDiffuseA = op.inFloatSlider("A", 1);
const diffuseColors = [inDiffuseR, inDiffuseG, inDiffuseB, inDiffuseA];
op.setPortGroup("Diffuse Color", diffuseColors);

const inToggleOrenNayar = op.inBool("Enable", false);
const inAlbedo = op.inFloatSlider("Albedo", 0.707);
const inRoughness = op.inFloatSlider("Roughness", 0.835);

inToggleOrenNayar.setUiAttribs({ "hidePort": true });
inAlbedo.setUiAttribs({ "greyout": true });
inRoughness.setUiAttribs({ "greyout": true });
inDiffuseR.setUiAttribs({ "colorPick": true });
op.setPortGroup("Oren-Nayar Diffuse", [inToggleOrenNayar, inAlbedo, inRoughness]);
op.toWorkShouldNotBeChild("Ops.Gl.TextureEffects.ImageCompose", CABLES.OP_PORT_TYPE_FUNCTION);

inToggleOrenNayar.onChange = function ()
{
    shader.toggleDefine("ENABLE_OREN_NAYAR_DIFFUSE", inToggleOrenNayar);
    inAlbedo.setUiAttribs({ "greyout": !inToggleOrenNayar.get() });
    inRoughness.setUiAttribs({ "greyout": !inToggleOrenNayar.get() });
};

// * FRESNEL *
const inToggleFresnel = op.inValueBool("Active", false);
inToggleFresnel.setUiAttribs({ "hidePort": true });
const inFresnel = op.inValueSlider("Fresnel Intensity", 0.7);
const inFresnelWidth = op.inFloat("Fresnel Width", 1);
const inFresnelExponent = op.inFloat("Fresnel Exponent", 6);
const inFresnelR = op.inFloat("Fresnel R", 1);
const inFresnelG = op.inFloat("Fresnel G", 1);
const inFresnelB = op.inFloat("Fresnel B", 1);
inFresnelR.setUiAttribs({ "colorPick": true });

const fresnelArr = [inFresnel, inFresnelWidth, inFresnelExponent, inFresnelR, inFresnelG, inFresnelB];
fresnelArr.forEach(function (port) { port.setUiAttribs({ "greyout": true }); });
op.setPortGroup("Fresnel", fresnelArr.concat([inToggleFresnel]));

let uniFresnel = null;
let uniFresnelWidthExponent = null;
inToggleFresnel.onChange = function ()
{
    shader.toggleDefine("ENABLE_FRESNEL", inToggleFresnel);
    if (inToggleFresnel.get())
    {
        if (!uniFresnel) uniFresnel = new CGL.Uniform(shader, "4f", "inFresnel", inFresnelR, inFresnelG, inFresnelB, inFresnel);
        if (!uniFresnelWidthExponent) uniFresnelWidthExponent = new CGL.Uniform(shader, "2f", "inFresnelWidthExponent", inFresnelWidth, inFresnelExponent);
    }
    else
    {
        if (uniFresnel)
        {
            shader.removeUniform("inFresnel");
            uniFresnel = null;
        }

        if (uniFresnelWidthExponent)
        {
            shader.removeUniform("inFresnelWidthExponent");
            uniFresnelWidthExponent = null;
        }
    }

    fresnelArr.forEach(function (port) { port.setUiAttribs({ "greyout": !inToggleFresnel.get() }); });
};
// * EMISSIVE *
const inEmissiveActive = op.inBool("Emissive Active", false);
const inEmissiveColorIntensity = op.inFloatSlider("Color Intensity", 0.3);
const inEmissiveR = op.inFloatSlider("Emissive R", Math.random());
const inEmissiveG = op.inFloatSlider("Emissive G", Math.random());
const inEmissiveB = op.inFloatSlider("Emissive B", Math.random());
inEmissiveR.setUiAttribs({ "colorPick": true });
op.setPortGroup("Emissive Color", [inEmissiveActive, inEmissiveColorIntensity, inEmissiveR, inEmissiveG, inEmissiveB]);

inEmissiveColorIntensity.setUiAttribs({ "greyout": !inEmissiveActive.get() });
inEmissiveR.setUiAttribs({ "greyout": !inEmissiveActive.get() });
inEmissiveG.setUiAttribs({ "greyout": !inEmissiveActive.get() });
inEmissiveB.setUiAttribs({ "greyout": !inEmissiveActive.get() });

let uniEmissiveColor = null;

inEmissiveActive.onChange = () =>
{
    shader.toggleDefine("ADD_EMISSIVE_COLOR", inEmissiveActive);

    if (inEmissiveActive.get())
    {
        uniEmissiveColor = new CGL.Uniform(shader, "4f", "inEmissiveColor", inEmissiveR, inEmissiveG, inEmissiveB, inEmissiveColorIntensity);
        inEmissiveTexture.setUiAttribs({ "greyout": false });
        inEmissiveMaskTexture.setUiAttribs({ "greyout": false });

        if (inEmissiveTexture.get()) inEmissiveIntensity.setUiAttribs({ "greyout": false });
        if (inEmissiveMaskTexture.get()) inEmissiveMaskIntensity.setUiAttribs({ "greyout": false });
    }
    else
    {
        op.log("ayayay");
        inEmissiveTexture.setUiAttribs({ "greyout": true });
        inEmissiveMaskTexture.setUiAttribs({ "greyout": true });
        inEmissiveIntensity.setUiAttribs({ "greyout": true });
        inEmissiveMaskIntensity.setUiAttribs({ "greyout": true });

        shader.removeUniform("inEmissiveColor");
        uniEmissiveColor = null;
    }

    if (inEmissiveTexture.get())
    {
        inEmissiveColorIntensity.setUiAttribs({ "greyout": true });
        inEmissiveR.setUiAttribs({ "greyout": true });
        inEmissiveG.setUiAttribs({ "greyout": true });
        inEmissiveB.setUiAttribs({ "greyout": true });
    }
    else
    {
        if (inEmissiveActive.get())
        {
            inEmissiveColorIntensity.setUiAttribs({ "greyout": false });
            inEmissiveR.setUiAttribs({ "greyout": false });
            inEmissiveG.setUiAttribs({ "greyout": false });
            inEmissiveB.setUiAttribs({ "greyout": false });
        }
        else
        {
            inEmissiveColorIntensity.setUiAttribs({ "greyout": true });
            inEmissiveR.setUiAttribs({ "greyout": true });
            inEmissiveG.setUiAttribs({ "greyout": true });
            inEmissiveB.setUiAttribs({ "greyout": true });
        }
    }
};
// * SPECULAR *
const inShininess = op.inFloat("Shininess", 4);
const inSpecularCoefficient = op.inFloatSlider("Specular Amount", 0.5);
const inSpecularMode = op.inSwitch("Specular Model", ["Blinn", "Schlick", "Phong", "Gauss"], "Blinn");

inSpecularMode.setUiAttribs({ "hidePort": true });
const specularColors = [inShininess, inSpecularCoefficient, inSpecularMode];
op.setPortGroup("Specular", specularColors);

// * LIGHT *
const inEnergyConservation = op.inValueBool("Energy Conservation", false);
const inToggleDoubleSided = op.inBool("Double Sided Material", false);
const inFalloffMode = op.inSwitch("Falloff Mode", ["A", "B", "C", "D"], "A");
inEnergyConservation.setUiAttribs({ "hidePort": true });
inToggleDoubleSided.setUiAttribs({ "hidePort": true });
inFalloffMode.setUiAttribs({ "hidePort": true });
inFalloffMode.onChange = () =>
{
    const MODES = ["A", "B", "C", "D"];
    shader.define("FALLOFF_MODE_" + inFalloffMode.get());
    MODES.filter((mode) => { return mode !== inFalloffMode.get(); })
        .forEach((mode) => { return shader.removeDefine("FALLOFF_MODE_" + mode); });
};

const lightProps = [inEnergyConservation, inToggleDoubleSided, inFalloffMode];
op.setPortGroup("Light Options", lightProps);

// TEXTURES
const inDiffuseTexture = op.inTexture("Diffuse Texture");
const inSpecularTexture = op.inTexture("Specular Texture");
const inNormalTexture = op.inTexture("Normal Map");
const inAoTexture = op.inTexture("AO Texture");
const inEmissiveTexture = op.inTexture("Emissive Texture");
const inEmissiveMaskTexture = op.inTexture("Emissive Mask");
const inAlphaTexture = op.inTexture("Opacity Texture");
const inEnvTexture = op.inTexture("Environment Map");
const inLuminanceMaskTexture = op.inTexture("Env Map Mask");
op.setPortGroup("Textures", [inDiffuseTexture, inSpecularTexture, inNormalTexture, inAoTexture, inEmissiveTexture, inEmissiveMaskTexture, inAlphaTexture, inEnvTexture, inLuminanceMaskTexture]);

// TEXTURE TRANSFORMS
const inColorizeTexture = op.inBool("Colorize Texture", false);
const inDiffuseRepeatX = op.inFloat("Diffuse Repeat X", 1);
const inDiffuseRepeatY = op.inFloat("Diffuse Repeat Y", 1);
const inTextureOffsetX = op.inFloat("Texture Offset X", 0);
const inTextureOffsetY = op.inFloat("Texture Offset Y", 0);

const inSpecularIntensity = op.inFloatSlider("Specular Intensity", 1);
const inNormalIntensity = op.inFloatSlider("Normal Map Intensity", 0.5);
const inAoIntensity = op.inFloatSlider("AO Intensity", 1);
const inAoChannel = op.inSwitch("AO UV Channel", ["1", "2"], 1);
const inEmissiveIntensity = op.inFloatSlider("Emissive Intensity", 1);
const inEmissiveMaskIntensity = op.inFloatSlider("Emissive Mask Intensity", 1);
const inEnvMapIntensity = op.inFloatSlider("Env Map Intensity", 1);
const inEnvMapBlend = op.inSwitch("Env Map Blend", ["Add", "Multiply", "Mix"], "Add");
const inLuminanceMaskIntensity = op.inFloatSlider("Env Mask Intensity", 1);

inColorizeTexture.setUiAttribs({ "hidePort": true });
op.setPortGroup("Texture Transforms", [inColorizeTexture, inDiffuseRepeatY, inDiffuseRepeatX, inTextureOffsetY, inTextureOffsetX]);
op.setPortGroup("Texture Intensities", [inNormalIntensity, inAoIntensity, inSpecularIntensity, inEmissiveIntensity, inEnvMapBlend, inEmissiveMaskIntensity, inEnvMapIntensity, inLuminanceMaskIntensity]);
const alphaMaskSource = op.inSwitch("Alpha Mask Source", ["Luminance", "R", "G", "B", "A"], "Luminance");
alphaMaskSource.setUiAttribs({ "greyout": true });

const discardTransPxl = op.inValueBool("Discard Transparent Pixels");
discardTransPxl.setUiAttribs({ "hidePort": true });

op.setPortGroup("Opacity Texture", [alphaMaskSource, discardTransPxl]);

inAoChannel.onChange =
    inEnvMapBlend.onChange =
    alphaMaskSource.onChange = updateDefines;

const outTrigger = op.outTrigger("Trigger Out");
const shaderOut = op.outObject("Shader", null, "shader");
shaderOut.ignoreValueSerialize = true;

const shader = new CGL.Shader(cgl, "phongmaterial_" + op.id, this);
shader.op = this;
shader.setModules(["MODULE_VERTEX_POSITION", "MODULE_COLOR", "MODULE_BEGIN_FRAG", "MODULE_BASE_COLOR", "MODULE_VERTEX_MODELVIEW"]);
shader.setSource(attachments.simosphong_vert, attachments.simosphong_frag);
// let recompileShader = false;
shader.define("FALLOFF_MODE_A");

if (cgl.glVersion < 2)
{
    shader.enableExtension("GL_OES_standard_derivatives");

    if (cgl.enableExtension("OES_texture_float")) shader.enableExtension("GL_OES_texture_float");
    else op.log("error loading extension OES_texture_float");

    if (cgl.enableExtension("OES_texture_float_linear")) shader.enableExtension("GL_OES_texture_float_linear");
    else op.log("error loading extention OES_texture_float_linear");

    if (cgl.enableExtension("GL_OES_texture_half_float")) shader.enableExtension("GL_OES_texture_half_float");
    else op.log("error loading extention GL_OES_texture_half_float");

    if (cgl.enableExtension("GL_OES_texture_half_float_linear")) shader.enableExtension("GL_OES_texture_half_float_linear");
    else op.log("error loading extention GL_OES_texture_half_float_linear");
}

const FRAGMENT_HEAD_REGEX = new RegExp("{{PHONG_FRAGMENT_HEAD}}", "g");
const FRAGMENT_BODY_REGEX = new RegExp("{{PHONG_FRAGMENT_BODY}}", "g");

const hasLight = {
    "directional": false,
    "spot": false,
    "ambient": false,
    "point": false,
};

function createShader(lightStack)
{
    let fragmentShader = attachments.phong_frag;

    let fragmentHead = "";
    let fragmentBody = "";

    hasLight.directional = false;
    hasLight.spot = false;
    hasLight.ambient = false;
    hasLight.point = false;

    for (let i = 0; i < lightStack.length; i += 1)
    {
        const light = lightStack[i];

        const type = light.type;

        if (!hasLight[type])
        {
            hasLight[type] = true;
        }

        fragmentHead = fragmentHead.concat(createFragmentHead(i));
        fragmentBody = fragmentBody.concat(createFragmentBody(i, light.type));
    }

    fragmentShader = fragmentShader.replace(FRAGMENT_HEAD_REGEX, fragmentHead);
    fragmentShader = fragmentShader.replace(FRAGMENT_BODY_REGEX, fragmentBody);

    shader.setSource(attachments.phong_vert, fragmentShader);

    for (let i = 0, keys = Object.keys(hasLight); i < keys.length; i += 1)
    {
        const key = keys[i];

        if (hasLight[key])
        {
            if (!shader.hasDefine("HAS_" + key.toUpperCase()))
            {
                shader.define("HAS_" + key.toUpperCase());
            }
        }
        else
        {
            if (shader.hasDefine("HAS_" + key.toUpperCase()))
            {
                shader.removeDefine("HAS_" + key.toUpperCase());
            }
        }
    }
}

shaderOut.setRef(shader);

let diffuseTextureUniform = null;
let specularTextureUniform = null;
let normalTextureUniform = null;
let aoTextureUniform = null;
let emissiveTextureUniform = null;
let emissiveMaskTextureUniform = null;
let emissiveMaskIntensityUniform = null;
let alphaTextureUniform = null;
let envTextureUniform = null;
let inEnvMapIntensityUni = null;
let inEnvMapWidthUni = null;
let luminanceTextureUniform = null;
let inLuminanceMaskIntensityUniform = null;

inColorizeTexture.onChange = function ()
{
    shader.toggleDefine("COLORIZE_TEXTURE", inColorizeTexture.get());
};

function updateDiffuseTexture()
{
    if (inDiffuseTexture.get())
    {
        if (!shader.hasDefine("HAS_TEXTURE_DIFFUSE"))
        {
            shader.define("HAS_TEXTURE_DIFFUSE");
            if (!diffuseTextureUniform) diffuseTextureUniform = new CGL.Uniform(shader, "t", "texDiffuse", 0);
        }
    }
    else
    {
        shader.removeUniform("texDiffuse");
        shader.removeDefine("HAS_TEXTURE_DIFFUSE");
        diffuseTextureUniform = null;
    }
}

function updateSpecularTexture()
{
    if (inSpecularTexture.get())
    {
        inSpecularIntensity.setUiAttribs({ "greyout": false });
        if (!shader.hasDefine("HAS_TEXTURE_SPECULAR"))
        {
            shader.define("HAS_TEXTURE_SPECULAR");
            if (!specularTextureUniform) specularTextureUniform = new CGL.Uniform(shader, "t", "texSpecular", 0);
        }
    }
    else
    {
        inSpecularIntensity.setUiAttribs({ "greyout": true });
        shader.removeUniform("texSpecular");
        shader.removeDefine("HAS_TEXTURE_SPECULAR");
        specularTextureUniform = null;
    }
}

function updateNormalTexture()
{
    if (inNormalTexture.get())
    {
        inNormalIntensity.setUiAttribs({ "greyout": false });

        if (!shader.hasDefine("HAS_TEXTURE_NORMAL"))
        {
            shader.define("HAS_TEXTURE_NORMAL");
            if (!normalTextureUniform) normalTextureUniform = new CGL.Uniform(shader, "t", "texNormal", 0);
        }
    }
    else
    {
        inNormalIntensity.setUiAttribs({ "greyout": true });

        shader.removeUniform("texNormal");
        shader.removeDefine("HAS_TEXTURE_NORMAL");
        normalTextureUniform = null;
    }
}

aoTextureUniform = new CGL.Uniform(shader, "t", "texAO");

function updateAoTexture()
{
    shader.toggleDefine("HAS_TEXTURE_AO", inAoTexture.get());

    inAoIntensity.setUiAttribs({ "greyout": !inAoTexture.get() });

    // if (inAoTexture.get())
    // {
    //     // inAoIntensity.setUiAttribs({ "greyout": false });

    //     // if (!shader.hasDefine("HAS_TEXTURE_AO"))
    //     // {
    //         // shader.define("HAS_TEXTURE_AO");
    //         // if (!aoTextureUniform)
    //         aoTextureUniform = new CGL.Uniform(shader, "t", "texAO", 0);
    //     // }
    // }
    // else
    // {
    //     // inAoIntensity.setUiAttribs({ "greyout": true });

    //     shader.removeUniform("texAO");
    //     // shader.removeDefine("HAS_TEXTURE_AO");
    //     aoTextureUniform = null;
    // }
}

function updateEmissiveTexture()
{
    if (inEmissiveTexture.get())
    {
        inEmissiveR.setUiAttribs({ "greyout": true });
        inEmissiveG.setUiAttribs({ "greyout": true });
        inEmissiveB.setUiAttribs({ "greyout": true });
        inEmissiveColorIntensity.setUiAttribs({ "greyout": true });

        if (inEmissiveActive.get())
        {
            inEmissiveIntensity.setUiAttribs({ "greyout": false });
        }

        if (!shader.hasDefine("HAS_TEXTURE_EMISSIVE"))
        {
            shader.define("HAS_TEXTURE_EMISSIVE");
            if (!emissiveTextureUniform) emissiveTextureUniform = new CGL.Uniform(shader, "t", "texEmissive", 0);
        }
    }
    else
    {
        inEmissiveIntensity.setUiAttribs({ "greyout": true });

        if (inEmissiveActive.get())
        {
            inEmissiveR.setUiAttribs({ "greyout": false });
            inEmissiveG.setUiAttribs({ "greyout": false });
            inEmissiveB.setUiAttribs({ "greyout": false });
            inEmissiveColorIntensity.setUiAttribs({ "greyout": false });
        }
        else
        {
            inEmissiveTexture.setUiAttribs({ "greyout": true });
        }

        shader.removeUniform("texEmissive");
        shader.removeDefine("HAS_TEXTURE_EMISSIVE");
        emissiveTextureUniform = null;
    }
}

function updateEmissiveMaskTexture()
{
    if (inEmissiveMaskTexture.get())
    { // we have a emissive texture
        if (inEmissiveActive.get())
        {
            inEmissiveMaskIntensity.setUiAttribs({ "greyout": false });
        }

        if (!shader.hasDefine("HAS_TEXTURE_EMISSIVE_MASK"))
        {
            shader.define("HAS_TEXTURE_EMISSIVE_MASK");
            if (!emissiveMaskTextureUniform) emissiveMaskTextureUniform = new CGL.Uniform(shader, "t", "texMaskEmissive", 0);
            if (!emissiveMaskIntensityUniform) emissiveMaskIntensityUniform = new CGL.Uniform(shader, "f", "inEmissiveMaskIntensity", inEmissiveMaskIntensity);
        }
    }
    else
    {
        if (!inEmissiveActive.get())
        {
            inEmissiveMaskTexture.setUiAttribs({ "greyout": true });
        }
        inEmissiveMaskIntensity.setUiAttribs({ "greyout": true });
        shader.removeUniform("texMaskEmissive");
        shader.removeUniform("inEmissiveMaskIntensity");
        shader.removeDefine("HAS_TEXTURE_EMISSIVE_MASK");
        emissiveMaskTextureUniform = null;
        emissiveMaskIntensityUniform = null;
    }
}

let updateEnvTextureLater = false;
function updateEnvTexture()
{
    shader.toggleDefine("HAS_TEXTURE_ENV", inEnvTexture.get());

    inEnvMapIntensity.setUiAttribs({ "greyout": !inEnvTexture.get() });

    if (inEnvTexture.get())
    {
        if (!envTextureUniform) envTextureUniform = new CGL.Uniform(shader, "t", "texEnv", 0);

        shader.toggleDefine("TEX_FORMAT_CUBEMAP", inEnvTexture.get().cubemap);

        if (inEnvTexture.get().cubemap)
        {
            shader.removeDefine("TEX_FORMAT_EQUIRECT");
            shader.removeDefine("ENVMAP_MATCAP");
            if (!inEnvMapIntensityUni)inEnvMapIntensityUni = new CGL.Uniform(shader, "f", "inEnvMapIntensity", inEnvMapIntensity);
            if (!inEnvMapWidthUni)inEnvMapWidthUni = new CGL.Uniform(shader, "f", "inEnvMapWidth", inEnvTexture.get().cubemap.width);
        }
        else
        {
            const isSquare = inEnvTexture.get().width === inEnvTexture.get().height;
            shader.toggleDefine("TEX_FORMAT_EQUIRECT", !isSquare);
            shader.toggleDefine("ENVMAP_MATCAP", isSquare);

            if (!inEnvMapIntensityUni)inEnvMapIntensityUni = new CGL.Uniform(shader, "f", "inEnvMapIntensity", inEnvMapIntensity);
            if (!inEnvMapWidthUni) inEnvMapWidthUni = new CGL.Uniform(shader, "f", "inEnvMapWidth", inEnvTexture.get().width);
        }
    }
    else
    {
        shader.removeUniform("inEnvMapIntensity");
        shader.removeUniform("inEnvMapWidth");
        shader.removeUniform("texEnv");
        shader.removeDefine("HAS_TEXTURE_ENV");
        shader.removeDefine("ENVMAP_MATCAP");
        envTextureUniform = null;
        inEnvMapIntensityUni = null;
    }

    updateEnvTextureLater = false;
}

function updateLuminanceMaskTexture()
{
    if (inLuminanceMaskTexture.get())
    {
        inLuminanceMaskIntensity.setUiAttribs({ "greyout": false });
        if (!luminanceTextureUniform)
        {
            shader.define("HAS_TEXTURE_LUMINANCE_MASK");
            luminanceTextureUniform = new CGL.Uniform(shader, "t", "texLuminance", 0);
            inLuminanceMaskIntensityUniform = new CGL.Uniform(shader, "f", "inLuminanceMaskIntensity", inLuminanceMaskIntensity);
        }
    }
    else
    {
        inLuminanceMaskIntensity.setUiAttribs({ "greyout": true });
        shader.removeDefine("HAS_TEXTURE_LUMINANCE_MASK");
        shader.removeUniform("inLuminanceMaskIntensity");
        shader.removeUniform("texLuminance");
        luminanceTextureUniform = null;
        inLuminanceMaskIntensityUniform = null;
    }
}

// TEX OPACITY

function updateDefines()
{
    shader.toggleDefine("ENV_BLEND_ADD", inEnvMapBlend.get() == "Add");
    shader.toggleDefine("ENV_BLEND_MUL", inEnvMapBlend.get() == "Multiply");
    shader.toggleDefine("ENV_BLEND_MIX", inEnvMapBlend.get() == "Mix");

    shader.toggleDefine("ALPHA_MASK_ALPHA", alphaMaskSource.get() == "A" || alphaMaskSource.get() == "Alpha");
    shader.toggleDefine("ALPHA_MASK_LUMI", alphaMaskSource.get() == "Luminance");
    shader.toggleDefine("ALPHA_MASK_R", alphaMaskSource.get() == "R");
    shader.toggleDefine("ALPHA_MASK_G", alphaMaskSource.get() == "G");
    shader.toggleDefine("ALPHA_MASK_B", alphaMaskSource.get() == "B");

    shader.toggleDefine("AO_CHAN_0", inAoChannel.get() == "1");
    shader.toggleDefine("AO_CHAN_1", inAoChannel.get() == "2");
}

function updateAlphaTexture()
{
    if (inAlphaTexture.get())
    {
        if (alphaTextureUniform !== null) return;
        shader.removeUniform("texAlpha");
        shader.define("HAS_TEXTURE_ALPHA");
        if (!alphaTextureUniform) alphaTextureUniform = new CGL.Uniform(shader, "t", "texAlpha", 0);

        alphaMaskSource.setUiAttribs({ "greyout": false });
        discardTransPxl.setUiAttribs({ "greyout": false });
    }
    else
    {
        shader.removeUniform("texAlpha");
        shader.removeDefine("HAS_TEXTURE_ALPHA");
        alphaTextureUniform = null;

        alphaMaskSource.setUiAttribs({ "greyout": true });
        discardTransPxl.setUiAttribs({ "greyout": true });
    }
    updateDefines();
}

discardTransPxl.onChange = function ()
{
    shader.toggleDefine("DISCARDTRANS", discardTransPxl.get());
};

inDiffuseTexture.onChange = updateDiffuseTexture;
inSpecularTexture.onChange = updateSpecularTexture;
inNormalTexture.onChange = updateNormalTexture;
inAoTexture.onChange = updateAoTexture;
inEmissiveTexture.onChange = updateEmissiveTexture;
inEmissiveMaskTexture.onChange = updateEmissiveMaskTexture;
inAlphaTexture.onChange = updateAlphaTexture;
inEnvTexture.onChange = () => { updateEnvTextureLater = true; };
inLuminanceMaskTexture.onChange = updateLuminanceMaskTexture;

const MAX_UNIFORM_FRAGMENTS = cgl.maxUniformsFrag;
const MAX_LIGHTS = MAX_UNIFORM_FRAGMENTS === 64 ? 6 : 16;

shader.define("MAX_LIGHTS", MAX_LIGHTS.toString());
shader.define("SPECULAR_PHONG");

inSpecularMode.onChange = function ()
{
    if (inSpecularMode.get() === "Phong")
    {
        shader.define("SPECULAR_PHONG");
        shader.removeDefine("SPECULAR_BLINN");
        shader.removeDefine("SPECULAR_GAUSS");
        shader.removeDefine("SPECULAR_SCHLICK");
    }
    else if (inSpecularMode.get() === "Blinn")
    {
        shader.define("SPECULAR_BLINN");
        shader.removeDefine("SPECULAR_PHONG");
        shader.removeDefine("SPECULAR_GAUSS");
        shader.removeDefine("SPECULAR_SCHLICK");
    }
    else if (inSpecularMode.get() === "Gauss")
    {
        shader.define("SPECULAR_GAUSS");
        shader.removeDefine("SPECULAR_BLINN");
        shader.removeDefine("SPECULAR_PHONG");
        shader.removeDefine("SPECULAR_SCHLICK");
    }
    else if (inSpecularMode.get() === "Schlick")
    {
        shader.define("SPECULAR_SCHLICK");
        shader.removeDefine("SPECULAR_BLINN");
        shader.removeDefine("SPECULAR_PHONG");
        shader.removeDefine("SPECULAR_GAUSS");
    }
};

inEnergyConservation.onChange = function ()
{
    shader.toggleDefine("CONSERVE_ENERGY", inEnergyConservation.get());
};

inToggleDoubleSided.onChange = function ()
{
    shader.toggleDefine("DOUBLE_SIDED", inToggleDoubleSided.get());
};

// * INIT UNIFORMS *

const uniMaterialProps = new CGL.Uniform(shader, "4f", "inMaterialProperties", inAlbedo, inRoughness, inShininess, inSpecularCoefficient);
const uniDiffuseColor = new CGL.Uniform(shader, "4f", "inDiffuseColor", inDiffuseR, inDiffuseG, inDiffuseB, inDiffuseA);
const uniTextureIntensities = new CGL.Uniform(shader, "4f", "inTextureIntensities", inNormalIntensity, inAoIntensity, inSpecularIntensity, inEmissiveIntensity);
const uniTextureRepeatOffset = new CGL.Uniform(shader, "4f", "inTextureRepeatOffset", inDiffuseRepeatX, inDiffuseRepeatY, inTextureOffsetX, inTextureOffsetY);

shader.uniformColorDiffuse = uniDiffuseColor;

const lightUniforms = [];
let oldCount = 0;

function createUniforms(lightsCount)
{
    for (let i = 0; i < lightUniforms.length; i += 1)
    {
        lightUniforms[i] = null;
    }

    for (let i = 0; i < lightsCount; i += 1)
    {
        lightUniforms[i] = null;
        if (!lightUniforms[i])
        {
            lightUniforms[i] = {
                "color": new CGL.Uniform(shader, "3f", "phongLight" + i + ".color", [1, 1, 1]),
                "position": new CGL.Uniform(shader, "3f", "phongLight" + i + ".position", [0, 11, 0]),
                "specular": new CGL.Uniform(shader, "3f", "phongLight" + i + ".specular", [1, 1, 1]),
                // intensity, attenuation, falloff, radius
                "lightProperties": new CGL.Uniform(shader, "4f", "phongLight" + i + ".lightProperties", [1, 1, 1, 1]),

                "conePointAt": new CGL.Uniform(shader, "3f", "phongLight" + i + ".conePointAt", vec3.create()),
                "spotProperties": new CGL.Uniform(shader, "3f", "phongLight" + i + ".spotProperties", [0, 0, 0, 0]),
                "castLight": new CGL.Uniform(shader, "i", "phongLight" + i + ".castLight", 1),

            };
        }
    }
}

function setDefaultUniform(light)
{
    defaultUniform.position.setValue(light.position);
    defaultUniform.color.setValue(light.color);
    defaultUniform.specular.setValue(light.specular);
    defaultUniform.lightProperties.setValue([
        light.intensity,
        light.attenuation,
        light.falloff,
        light.radius,
    ]);

    defaultUniform.conePointAt.setValue(light.conePointAt);
    defaultUniform.spotProperties.setValue([
        light.cosConeAngle,
        light.cosConeAngleInner,
        light.spotExponent,
    ]);
}

function setUniforms(lightStack)
{
    for (let i = 0; i < lightStack.length; i += 1)
    {
        const light = lightStack[i];
        light.isUsed = true;

        lightUniforms[i].position.setValue(light.position);
        lightUniforms[i].color.setValue(light.color);
        lightUniforms[i].specular.setValue(light.specular);

        lightUniforms[i].lightProperties.setValue([
            light.intensity,
            light.attenuation,
            light.falloff,
            light.radius,
        ]);

        lightUniforms[i].conePointAt.setValue(light.conePointAt);
        lightUniforms[i].spotProperties.setValue([
            light.cosConeAngle,
            light.cosConeAngleInner,
            light.spotExponent,
        ]);

        lightUniforms[i].castLight.setValue(light.castLight);
    }
}

function compareLights(lightStack)
{
    if (lightStack.length !== oldCount)
    {
        createShader(lightStack);
        createUniforms(lightStack.length);
        oldCount = lightStack.length;
        setUniforms(lightStack);
        // recompileShader = false;
    }
    else
    {
        // if (recompileShader)
        // {
        //     createShader(lightStack);
        //     createUniforms(lightStack.length);
        //     recompileShader = false;
        // }
        setUniforms(lightStack);
    }
}

let defaultUniform = null;

function createDefaultUniform()
{
    defaultUniform = {
        "color": new CGL.Uniform(shader, "3f", "phongLight" + 0 + ".color", [1, 1, 1]),
        "specular": new CGL.Uniform(shader, "3f", "phongLight" + 0 + ".specular", [1, 1, 1]),
        "position": new CGL.Uniform(shader, "3f", "phongLight" + 0 + ".position", [0, 11, 0]),
        // intensity, attenuation, falloff, radius
        "lightProperties": new CGL.Uniform(shader, "4f", "phongLight" + 0 + ".lightProperties", [1, 1, 1, 1]),
        "conePointAt": new CGL.Uniform(shader, "3f", "phongLight" + 0 + ".conePointAt", vec3.create()),
        "spotProperties": new CGL.Uniform(shader, "3f", "phongLight" + 0 + ".spotProperties", [0, 0, 0, 0]),
        "castLight": new CGL.Uniform(shader, "i", "phongLight" + 0 + ".castLight", 1),
    };
}

const DEFAULT_LIGHTSTACK = [{
    "type": "point",
    "position": [5, 5, 5],
    "color": [1, 1, 1],
    "specular": [1, 1, 1],
    "intensity": 1,
    "attenuation": 0,
    "falloff": 0.5,
    "radius": 80,
    "castLight": 1,
}];

const iViewMatrix = mat4.create();

function updateLights()
{
    if (cgl.tempData.lightStack)
    {
        if (cgl.tempData.lightStack.length === 0)
        {
            op.setUiError("deflight", "Default light is enabled. Please add lights to your patch to make this warning disappear.", 1);
        }
        else op.setUiError("deflight", null);
    }

    if ((!cgl.tempData.lightStack || !cgl.tempData.lightStack.length))
    {
        // if no light in light stack, use default light & set count to -1
        // so when a new light gets added, the shader does recompile
        if (!defaultUniform)
        {
            createDefaultShader();
            createDefaultUniform();
        }

        mat4.invert(iViewMatrix, cgl.vMatrix);
        // set default light position to camera position
        DEFAULT_LIGHTSTACK[0].position = [iViewMatrix[12], iViewMatrix[13], iViewMatrix[14]];
        setDefaultUniform(DEFAULT_LIGHTSTACK[0]);

        oldCount = -1;
    }
    else
    {
        if (shader)
        {
            if (cgl.tempData.lightStack)
            {
                if (cgl.tempData.lightStack.length)
                {
                    defaultUniform = null;
                    compareLights(cgl.tempData.lightStack);
                }
            }
        }
    }
}

const render = function ()
{
    if (!shader)
    {
        op.log("NO SHADER");
        return;
    }

    cgl.pushShader(shader);
    shader.popTextures();

    outTrigger.trigger();
    cgl.popShader();
};

op.preRender = function ()
{
    shader.bind();
    render();
};

/* transform for default light */
const inverseViewMat = mat4.create();
const vecTemp = vec3.create();
const camPos = vec3.create();

inTrigger.onTriggered = function ()
{
    if (!shader)
    {
        op.log("phong has no shader...");
        return;
    }

    if (updateEnvTextureLater)updateEnvTexture();

    cgl.pushShader(shader);

    shader.popTextures();

    if (inDiffuseTexture.get()) shader.pushTexture(diffuseTextureUniform, inDiffuseTexture.get());
    if (inSpecularTexture.get()) shader.pushTexture(specularTextureUniform, inSpecularTexture.get());
    if (inNormalTexture.get()) shader.pushTexture(normalTextureUniform, inNormalTexture.get());
    if (inAoTexture.get()) shader.pushTexture(aoTextureUniform, inAoTexture.get());
    if (inEmissiveTexture.get()) shader.pushTexture(emissiveTextureUniform, inEmissiveTexture.get());
    if (inEmissiveMaskTexture.get()) shader.pushTexture(emissiveMaskTextureUniform, inEmissiveMaskTexture.get());
    if (inAlphaTexture.get()) shader.pushTexture(alphaTextureUniform, inAlphaTexture.get());
    if (inEnvTexture.get())
    {
        if (inEnvTexture.get().cubemap) shader.pushTexture(envTextureUniform, inEnvTexture.get().cubemap, cgl.gl.TEXTURE_CUBE_MAP);
        else shader.pushTexture(envTextureUniform, inEnvTexture.get());
    }

    if (inLuminanceMaskTexture.get())
    {
        shader.pushTexture(luminanceTextureUniform, inLuminanceMaskTexture.get());
    }

    updateLights();

    outTrigger.trigger();

    cgl.popShader();
};

if (cgl.glVersion == 1)
{
    if (!cgl.enableExtension("EXT_shader_texture_lod"))
    {
        op.log("no EXT_shader_texture_lod texture extension");
        // throw "no EXT_shader_texture_lod texture extension";
    }
    else
    {
        shader.enableExtension("GL_EXT_shader_texture_lod");
        cgl.enableExtension("OES_texture_float");
        cgl.enableExtension("OES_texture_float_linear");
        cgl.enableExtension("OES_texture_half_float");
        cgl.enableExtension("OES_texture_half_float_linear");

        shader.enableExtension("GL_OES_standard_derivatives");
        shader.enableExtension("GL_OES_texture_float");
        shader.enableExtension("GL_OES_texture_float_linear");
        shader.enableExtension("GL_OES_texture_half_float");
        shader.enableExtension("GL_OES_texture_half_float_linear");
    }
}

updateDiffuseTexture();
updateSpecularTexture();
updateNormalTexture();
updateAoTexture();
updateAlphaTexture();
updateEmissiveTexture();
updateEmissiveMaskTexture();
updateEnvTexture();
updateLuminanceMaskTexture();

}
};

CABLES.OPS["0d83ed06-cdbe-4fe0-87bb-0ccece7fb6e1"]={f:Ops.Gl.Phong.PhongMaterial_v6,objName:"Ops.Gl.Phong.PhongMaterial_v6"};




// **************************************************************
// 
// Ops.Extension.OpenType.OpentypeToSvgPath
// 
// **************************************************************

Ops.Extension.OpenType.OpentypeToSvgPath= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    inFont = op.inObject("Opentype Font"),
    inStr = op.inString("Text", "cables"),
    inLs = op.inFloat("Letter Spacing", 0),
    outPathStr = op.outString("Path String");

inStr.onChange =
inLs.onChange =
inFont.onChange = async function ()
{
    const font = inFont.get();
    if (!font || !font.getPath)
    {
        outPathStr.set("");
        return;
    }

    const paths = font.getPaths(inStr.get(), 0, 0, 72);
    let str = "";

    let ls = inLs.get();

    for (let i = 0; i < paths.length; i++)
    {
        for (let j = 0; j < paths[i].commands.length; j++)
        {
            if (paths[i].commands[j].hasOwnProperty("x"))
                paths[i].commands[j].x += i * ls;
            if (paths[i].commands[j].hasOwnProperty("x1"))
                paths[i].commands[j].x1 += i * ls;
        }
        str += paths[i].toPathData();
    }

    outPathStr.set(str);
};

}
};

CABLES.OPS["4d901c72-b8dc-45dc-ac2e-608e5da40677"]={f:Ops.Extension.OpenType.OpentypeToSvgPath,objName:"Ops.Extension.OpenType.OpentypeToSvgPath"};




// **************************************************************
// 
// Ops.Graphics.Geometry.SvgPathToGeometry_v2
// 
// **************************************************************

Ops.Graphics.Geometry.SvgPathToGeometry_v2= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    inStr = op.inString("SVG Path"),
    inStepSize = op.inFloat("Bezier Stepsize", 3),
    inRescale = op.inFloat("Rescale", 1),
    outGeom = op.outObject("Geometry", null, "geometry");

inStepSize.onChange =
inRescale.onChange =
inStr.onChange = () =>
{
    let str = inStr.get();

    if (!str || str.length < 2)
    {
        outGeom.set(null);
        return;
    }

    str = str.replace(/([A-Z,a-z])/g, " $1 ");

    const cmds = fromPathToArray(str);

    // create a list of closed contours
    const polys = [];
    cmds.forEach(({ type, x, y, x1, y1, x2, y2 }) =>
    {
        switch (type)
        {
        case "M":
            polys.push(new Polygon());
            polys[polys.length - 1].moveTo({ x, y });
            break;
        case "L":
            polys[polys.length - 1].moveTo({ x, y });
            break;
        case "C":
            polys[polys.length - 1].cubicTo({ x, y }, { "x": x1, "y": y1 }, { "x": x2, "y": y2 });
            break;
        case "Q":
            polys[polys.length - 1].conicTo({ x, y }, { "x": x1, "y": y1 });
            break;
        case "Z":
            polys[polys.length - 1].close();
            break;
        }
    });

    // sort contours by descending area
    polys.sort((a, b) => { return Math.abs(b.area) - Math.abs(a.area); });
    // classify contours to find holes and their 'parents'
    const root = [];
    for (let i = 0; i < polys.length; ++i)
    {
        let parent = null;
        for (let j = i - 1; j >= 0; --j)
        {
            // a contour is a hole if it is inside its parent and has different winding
            if (polys[j].inside(polys[i].points[0]) && polys[i].area * polys[j].area < 0)
            {
                parent = polys[j];
                break;
            }
        }
        if (parent)
        {
            parent.children.push(polys[i]);
        }
        else
        {
            root.push(polys[i]);
        }
    }

    const totalPoints = polys.reduce((sum, p) => { return sum + p.points.length; }, 0);
    const vertexData = new Float32Array(totalPoints * 2);
    let vertexCount = 0;
    const indices = [];

    function process(poly)
    {
        // construct input for earcut
        const coords = [];
        const holes = [];

        poly.points.forEach(({ x, y }) => { return coords.push(x, y); });

        poly.children.forEach((child) =>
        {
            // children's children are new, separate shapes
            child.children.forEach(process);

            holes.push(coords.length / 2);
            child.points.forEach(({ x, y }) => { return coords.push(x, y); });
        });

        // add vertex data
        vertexData.set(coords, vertexCount * 2);
        // add index data
        earcut(coords, holes).forEach((i) => { return indices.push(i + vertexCount); });
        vertexCount += coords.length / 2;
    }

    root.forEach(process);

    const finalVertexData = new Float32Array(totalPoints * 3);

    let max = -99999;

    for (let i = 0; i < finalVertexData.length / 3; i++)
    {
        finalVertexData[i * 3 + 0] = vertexData[i * 2 + 0];
        finalVertexData[i * 3 + 1] = vertexData[i * 2 + 1] * -1;
        max = Math.max(finalVertexData[i * 3 + 1], max);

        finalVertexData[i * 3 + 2] = 0;
    }

    let resc = inRescale.get();

    let geom = new CGL.Geometry("circle");
    geom.setVertices(finalVertexData);
    geom.verticesIndices = indices;

    if (resc != 0)
    {
        const bounds = geom.getBounds();
        for (let i = 0; i < finalVertexData.length / 3; i++)
        {
            finalVertexData[i * 3 + 0] = (finalVertexData[i * 3 + 0] / (bounds.size[0] / 2)) * resc;
            finalVertexData[i * 3 + 1] = (finalVertexData[i * 3 + 1] / (bounds.size[0] / 2)) * resc;
        }
        geom.setVertices(finalVertexData);
    }

    geom.mapTexCoords2d();
    geom.flipVertDir();
    geom.calculateNormals();
    geom.calcTangentsBitangents();

    outGeom.set(geom);
};

const PATH_COMMANDS = {
    "M": ["x", "y"],
    "m": ["dx", "dy"],
    "H": ["x"],
    "h": ["dx"],
    "V": ["y"],
    "v": ["dy"],
    "L": ["x", "y"],
    "l": ["dx", "dy"],
    "Z": [],
    "C": ["x1", "y1", "x2", "y2", "x", "y"],
    "c": ["dx1", "dy1", "dx2", "dy2", "dx", "dy"],
    "S": ["x2", "y2", "x", "y"],
    "s": ["dx2", "dy2", "dx", "dy"],
    "Q": ["x1", "y1", "x", "y"],
    "q": ["dx1", "dy1", "dx", "dy"],
    "T": ["x", "y"],
    "t": ["dx", "dy"],
    "A": ["rx", "ry", "rotation", "large-arc", "sweep", "x", "y"],
    "a": ["rx", "ry", "rotation", "large-arc", "sweep", "dx", "dy"]
};

function fromPathToArray(path)
{
    const items = path.replace(/[\n\r]/g, "")
        .replace(/-/g, " -")
        .replace(/(\d*\.)(\d+)(?=\.)/g, "$1$2 ")
        .trim()
        .split(/\s*,|\s+/);

    const segments = [];
    let currentCommand = "";
    let currentElement = {};
    while (items.length > 0)
    {
        let it = items.shift();
        if (PATH_COMMANDS.hasOwnProperty(it))
        {
            currentCommand = it;
        }
        else
        {
            items.unshift(it);
        }

        currentElement = { "type": currentCommand };
        PATH_COMMANDS[currentCommand].forEach((prop) =>
        {
            it = items.shift(); // TODO sanity check
            currentElement[prop] = parseFloat(it);
        });
        if (currentCommand === "M")
        {
            currentCommand = "L";
        }
        else if (currentCommand === "m")
        {
            currentCommand = "l";
        }
        segments.push(currentElement);
    }
    return segments;
}

// https://stackoverflow.com/questions/50554803/triangulate-path-data-from-opentype-js-using-earcut

const MAX_BEZIER_STEPS = 15;
// this is for inside checks - doesn't have to be particularly
// small because glyphs have finite resolution
const EPSILON = 1e-6;

class Polygon
{
    constructor()
    {
        this.points = [];
        this.children = [];
        this.area = 0.0;

        this.BEZIER_STEP_SIZE = inStepSize.get();
    }

    moveTo(p)
    {
        this.points.push(p);
    }

    lineTo(p)
    {
        this.points.push(p);
    }

    close()
    {
        let cur = this.points[this.points.length - 1];
        this.points.forEach((next) =>
        {
            this.area += 0.5 * cross(cur, next);
            cur = next;
        });
    }

    conicTo(p, p1)
    {
        const p0 = this.points[this.points.length - 1];
        const dist = distance(p0, p1) + distance(p1, p);
        const steps = Math.max(2, Math.min(MAX_BEZIER_STEPS, dist / this.BEZIER_STEP_SIZE));
        for (let i = 1; i <= steps; ++i)
        {
            const t = i / steps;
            this.points.push(lerp(lerp(p0, p1, t), lerp(p1, p, t), t));
        }
    }

    cubicTo(p, p1, p2)
    {
        const p0 = this.points[this.points.length - 1];
        const dist = distance(p0, p1) + distance(p1, p2) + distance(p2, p);
        const steps = Math.max(2, Math.min(MAX_BEZIER_STEPS, dist / this.BEZIER_STEP_SIZE));
        for (let i = 1; i <= steps; ++i)
        {
            const t = i / steps;
            const a = lerp(lerp(p0, p1, t), lerp(p1, p2, t), t);
            const b = lerp(lerp(p1, p2, t), lerp(p2, p, t), t);
            this.points.push(lerp(a, b, t));
        }
    }

    inside(p)
    {
        let count = 0, cur = this.points[this.points.length - 1];
        this.points.forEach((next) =>
        {
            const p0 = (cur.y < next.y ? cur : next);
            const p1 = (cur.y < next.y ? next : cur);
            if (p0.y < p.y + EPSILON && p1.y > p.y + EPSILON)
            {
                if ((p1.x - p0.x) * (p.y - p0.y) > (p.x - p0.x) * (p1.y - p0.y))
                {
                    count += 1;
                }
            }
            cur = next;
        });
        return (count % 2) !== 0;
    }
}

function distance(p1, p2)
{
    const dx = p1.x - p2.x, dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function lerp(p1, p2, t)
{
    return { "x": (1 - t) * p1.x + t * p2.x, "y": (1 - t) * p1.y + t * p2.y };
}

function cross(p1, p2)
{
    return p1.x * p2.y - p1.y * p2.x;
}

}
};

CABLES.OPS["4267b3e7-1285-4a3e-acc8-ea92a72a6bc0"]={f:Ops.Graphics.Geometry.SvgPathToGeometry_v2,objName:"Ops.Graphics.Geometry.SvgPathToGeometry_v2"};




// **************************************************************
// 
// Ops.Graphics.Geometry.FlipNormals
// 
// **************************************************************

Ops.Graphics.Geometry.FlipNormals= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    geometry = op.inObject("Geometry"),
    outGeom = op.outObject("Result"),
    doFlip = op.inValueBool("Flip", true),
    doNormalize = op.inValueBool("Normalize", true);

doFlip.onChange =
    doNormalize.onChange =
    geometry.onChange = flip;

function flip()
{
    let oldGeom = geometry.get();

    if (!oldGeom)
    {
        outGeom.set(null);
        return;
    }

    let geom = oldGeom.copy();

    if (doFlip.get())
    {
        for (let i = 0; i < geom.vertexNormals.length; i++)
            geom.vertexNormals[i] *= -1;

        if (doNormalize.get())
        {
            let vec = vec3.create();

            for (let i = 0; i < geom.vertexNormals.length; i += 3)
            {
                vec3.set(vec,
                    geom.vertexNormals[i + 0],
                    geom.vertexNormals[i + 1],
                    geom.vertexNormals[i + 2]);
                vec3.normalize(vec, vec);

                geom.vertexNormals[i + 0] = vec[0];
                geom.vertexNormals[i + 1] = vec[1];
                geom.vertexNormals[i + 2] = vec[2];
            }
        }
    }

    outGeom.set(geom);
}

}
};

CABLES.OPS["0055f588-dde6-4232-958b-4c19cdc67abd"]={f:Ops.Graphics.Geometry.FlipNormals,objName:"Ops.Graphics.Geometry.FlipNormals"};




// **************************************************************
// 
// Ops.Gl.RenderGeometry_v2
// 
// **************************************************************

Ops.Gl.RenderGeometry_v2= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    render = op.inTrigger("render"),
    geometry = op.inObject("Geometry", null, "geometry"),
    inActive = op.inBool("Render Mesh", true),

    inVertNums = op.inBool("Add Vertex Numbers", true),
    trigger = op.outTrigger("trigger");

op.toWorkPortsNeedToBeLinked(geometry, render);

geometry.ignoreValueSerialize = true;

let mesh = null;
let needsUpdate = true;

geometry.onLinkChanged =
inVertNums.onChange =
    geometry.onChange = () => { needsUpdate = true; };

render.onTriggered = function ()
{
    if (needsUpdate) update();
    if (mesh && inActive.get()) mesh.render(op.patch.cgl.getShader());
    trigger.trigger();
};

function update()
{
    needsUpdate = false;
    const geom = geometry.get();
    if (geom && geom.isGeometry)
    {
        if (mesh)
        {
            mesh.dispose();
            mesh = null;
        }
        if (!mesh)
        {
            mesh = new CGL.Mesh(op.patch.cgl, geom);
            mesh.addVertexNumbers = inVertNums.get();
            mesh.setGeom(geom);
        }
    }
    else
    {
        mesh = null;
    }
}

}
};

CABLES.OPS["0a9bdb39-8250-460e-8d99-50fe6825d956"]={f:Ops.Gl.RenderGeometry_v2,objName:"Ops.Gl.RenderGeometry_v2"};




// **************************************************************
// 
// Ops.Graphics.Geometry.GeometryExtrude
// 
// **************************************************************

Ops.Graphics.Geometry.GeometryExtrude= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    inGeom = op.inObject("Geometry", null, "geometry"),
    inHeight = op.inFloat("Height", 0.5),
    inSmooth = op.inBool("Smooth", true),
    inExtrudeWalls = op.inBool("Walls", true),
    inCapTop = op.inBool("Top", true),
    inCapBottom = op.inBool("Bottom", true),
    outGeom = op.outObject("Result Geometry", null, "geometry");

function isClockwise(verts)
{
    let sum = 0.0;
    for (let i = 0; i < verts.length - 3; i += 3)
    {
        // Vector v1 = verts[i];
        // Vector v2 = verts[(i + 1) % verts.length];
        sum += (verts[i + 3] - verts[i]) * (verts[i + 3 + 1] + verts[i]);
    }
    return sum > 0.0;
}

inSmooth.onChange =
inExtrudeWalls.onChange =
inCapTop.onChange =
inCapBottom.onChange =
inHeight.onChange =
inGeom.onChange = () =>
{
    const geom = inGeom.get();

    if (!geom)
    {
        outGeom.set(null);
        return;
    }

    function edgesUsedMulti(idx1, idx2)
    {
        let count = 0;
        for (let i = 0; i < geom.verticesIndices.length; i += 3)
        {
            if (
                (
                    geom.verticesIndices[i] == idx1 ||
                    geom.verticesIndices[i + 1] == idx1 ||
                    geom.verticesIndices[i + 2] == idx1
                ) &&
                (
                    geom.verticesIndices[i] == idx2 ||
                    geom.verticesIndices[i + 1] == idx2 ||
                    geom.verticesIndices[i + 2] == idx2
                ))
            {
                count++;
                if (count == 2) return true;
            }
        }

        return false;
    }

    let verts = [];
    const indices = [];
    const h = inHeight.get();

    if (inExtrudeWalls.get())
        for (let i = 0; i < geom.verticesIndices.length; i += 3)
        {
            const vert1 = geom.verticesIndices[i];
            const vert2 = geom.verticesIndices[i + 1];
            const vert3 = geom.verticesIndices[i + 2];

            // 1
            if (!edgesUsedMulti(vert1, vert2))
            {
                const a = [];
                a.push([geom.vertices[vert1 * 3 + 0], geom.vertices[vert1 * 3 + 1], geom.vertices[vert1 * 3 + 2]]);
                a.push([geom.vertices[vert1 * 3 + 0], geom.vertices[vert1 * 3 + 1], geom.vertices[vert1 * 3 + 2] + h]);
                a.push([geom.vertices[vert2 * 3 + 0], geom.vertices[vert2 * 3 + 1], geom.vertices[vert2 * 3 + 2]]);

                if (!isClockwise(a)) verts = verts.concat(a);
                else verts = verts.concat(a.reverse());

                a.length = 0;
                a.push([geom.vertices[vert2 * 3 + 0], geom.vertices[vert2 * 3 + 1], geom.vertices[vert2 * 3 + 2] + h]);
                a.push([geom.vertices[vert2 * 3 + 0], geom.vertices[vert2 * 3 + 1], geom.vertices[vert2 * 3 + 2]]);
                a.push([geom.vertices[vert1 * 3 + 0], geom.vertices[vert1 * 3 + 1], geom.vertices[vert1 * 3 + 2] + h]);

                if (!isClockwise(a)) verts = verts.concat(a);
                else verts = verts.concat(a.reverse());
            }

            // 2
            if (!edgesUsedMulti(vert3, vert2))
            {
                const a = [];
                a.push([geom.vertices[vert3 * 3 + 0], geom.vertices[vert3 * 3 + 1], geom.vertices[vert3 * 3 + 2]]);
                a.push([geom.vertices[vert3 * 3 + 0], geom.vertices[vert3 * 3 + 1], geom.vertices[vert3 * 3 + 2] + h]);
                a.push([geom.vertices[vert2 * 3 + 0], geom.vertices[vert2 * 3 + 1], geom.vertices[vert2 * 3 + 2]]);

                if (isClockwise(a)) verts = verts.concat(a);
                else verts = verts.concat(a.reverse());

                a.length = 0;

                a.push([geom.vertices[vert2 * 3 + 0], geom.vertices[vert2 * 3 + 1], geom.vertices[vert2 * 3 + 2] + h]);
                a.push([geom.vertices[vert2 * 3 + 0], geom.vertices[vert2 * 3 + 1], geom.vertices[vert2 * 3 + 2]]);
                a.push([geom.vertices[vert3 * 3 + 0], geom.vertices[vert3 * 3 + 1], geom.vertices[vert3 * 3 + 2] + h]);

                if (isClockwise(a)) verts = verts.concat(a);
                else verts = verts.concat(a.reverse());
            }
            // 3

            if (!edgesUsedMulti(vert3, vert1))
            {
                const a = [];
                a.push([geom.vertices[vert3 * 3 + 0], geom.vertices[vert3 * 3 + 1], geom.vertices[vert3 * 3 + 2]]);
                a.push([geom.vertices[vert3 * 3 + 0], geom.vertices[vert3 * 3 + 1], geom.vertices[vert3 * 3 + 2] + h]);
                a.push([geom.vertices[vert1 * 3 + 0], geom.vertices[vert1 * 3 + 1], geom.vertices[vert1 * 3 + 2]]);

                if (!isClockwise(a)) verts = verts.concat(a);
                else verts = verts.concat(a.reverse());

                a.length = 0;

                a.push([geom.vertices[vert1 * 3 + 0], geom.vertices[vert1 * 3 + 1], geom.vertices[vert1 * 3 + 2] + h]);
                a.push([geom.vertices[vert1 * 3 + 0], geom.vertices[vert1 * 3 + 1], geom.vertices[vert1 * 3 + 2]]);
                a.push([geom.vertices[vert3 * 3 + 0], geom.vertices[vert3 * 3 + 1], geom.vertices[vert3 * 3 + 2] + h]);

                if (!isClockwise(a)) verts = verts.concat(a);
                else verts = verts.concat(a.reverse());
            }
        }

    const newGeom = CGL.Geometry.buildFromFaces(verts, "extrude", true);

    newGeom.calculateNormals();
    newGeom.calcTangentsBitangents();

    if (inCapBottom.get())
    {
        newGeom.merge(geom);
    }

    if (inCapTop.get())
    {
        const flippedgeo = geom.copy();

        for (let i = 0; i < flippedgeo.vertices.length; i += 3)
            flippedgeo.vertices[i + 2] += h;

        flippedgeo.flipVertDir();
        flippedgeo.flipNormals();
        newGeom.merge(flippedgeo);
    }

    newGeom.flipVertDir();

    if (!inSmooth.get())
    {
        newGeom.unIndex();
        newGeom.calculateNormals({ "forceZUp": true });
        newGeom.flipNormals();
    }

    outGeom.set(null);
    outGeom.set(newGeom);
};

}
};

CABLES.OPS["64a34a29-000d-4350-875f-5b72b97a314f"]={f:Ops.Graphics.Geometry.GeometryExtrude,objName:"Ops.Graphics.Geometry.GeometryExtrude"};




// **************************************************************
// 
// Ops.Number.Number
// 
// **************************************************************

Ops.Number.Number= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    v = op.inValueFloat("value"),
    result = op.outNumber("result");

v.onChange = exec;

let isLinked = false;
v.onLinkChanged = () =>
{
    if (!isLinked && v.isLinked())op.setUiAttribs({ "extendTitle": null });
    isLinked = v.isLinked();
};

function exec()
{
    if (CABLES.UI && !isLinked) op.setUiAttribs({ "extendTitle": v.get() });

    result.set(Number(v.get()));
}

}
};

CABLES.OPS["8fb2bb5d-665a-4d0a-8079-12710ae453be"]={f:Ops.Number.Number,objName:"Ops.Number.Number"};




// **************************************************************
// 
// Ops.Vars.VarSetNumber_v2
// 
// **************************************************************

Ops.Vars.VarSetNumber_v2= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const val = op.inValueFloat("Value", 0);
op.varName = op.inDropDown("Variable", [], "", true);

new CABLES.VarSetOpWrapper(op, "number", val, op.varName);

}
};

CABLES.OPS["b5249226-6095-4828-8a1c-080654e192fa"]={f:Ops.Vars.VarSetNumber_v2,objName:"Ops.Vars.VarSetNumber_v2"};




// **************************************************************
// 
// Ops.Math.Multiply
// 
// **************************************************************

Ops.Math.Multiply= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    number1 = op.inValueFloat("number1", 1),
    number2 = op.inValueFloat("number2", 1),
    result = op.outNumber("result");

op.setUiAttribs({ "mathTitle": true });

number1.onChange = number2.onChange = update;
update();

function update()
{
    const n1 = number1.get();
    const n2 = number2.get();

    result.set(n1 * n2);
}

}
};

CABLES.OPS["1bbdae06-fbb2-489b-9bcc-36c9d65bd441"]={f:Ops.Math.Multiply,objName:"Ops.Math.Multiply"};




// **************************************************************
// 
// Ops.Math.Sum
// 
// **************************************************************

Ops.Math.Sum= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    number1 = op.inValueFloat("number1", 0),
    number2 = op.inValueFloat("number2", 0),
    result = op.outNumber("result");

op.setUiAttribs({ "mathTitle": true });

number1.onChange =
number2.onChange = exec;
exec();

function exec()
{
    const v = number1.get() + number2.get();
    if (!isNaN(v))
        result.set(v);
}

}
};

CABLES.OPS["c8fb181e-0b03-4b41-9e55-06b6267bc634"]={f:Ops.Math.Sum,objName:"Ops.Math.Sum"};




// **************************************************************
// 
// Ops.Math.Floor
// 
// **************************************************************

Ops.Math.Floor= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const number1 = op.inValue("Number");
const result = op.outNumber("Result");
number1.onChange = exec;

function exec()
{
    result.set(Math.floor(number1.get()));
}

}
};

CABLES.OPS["0c77617c-b688-4b55-addf-2cbcaabf98af"]={f:Ops.Math.Floor,objName:"Ops.Math.Floor"};




// **************************************************************
// 
// Ops.Gl.Meshes.Grid
// 
// **************************************************************

Ops.Gl.Meshes.Grid= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    render = op.inTrigger("Render"),
    inNum = op.inInt("Num", 10),
    inSpacing = op.inValue("Spacing", 1),
    inCenter = op.inBool("Center", true),
    axis = op.inSwitch("Axis", ["XY", "XZ"], "XY"),
    next = op.outTrigger("Next");

const cgl = op.patch.cgl;
let mesh = null;

axis.onChange =
    inCenter.onChange =
    inNum.onChange =
    inSpacing.onChange = function ()
    {
        if (mesh)mesh.dispose();
        mesh = null;
    };

function init()
{
    const geomStepsOne = new CGL.Geometry(op.name);
    const geomX = new CGL.Geometry(op.name);

    const space = inSpacing.get();
    const num = Math.floor(inNum.get());
    const l = space * num / 2;

    const tc = [];

    let start = -num / 2;
    let end = num / 2 + 1;

    if (axis.get() == "XY")
        for (let i = start; i < end; i++)
        {
            geomStepsOne.vertices.push(-l, i * space, 0);
            geomStepsOne.vertices.push(l, i * space, 0);
            geomStepsOne.vertices.push(i * space, -l, 0);
            geomStepsOne.vertices.push(i * space, l, 0);

            tc.push(0, 0, 0, 0, 0, 0, 0, 0);
        }
    else
        for (let i = start; i < end; i++)
        {
            geomStepsOne.vertices.push(-l, 0, i * space);
            geomStepsOne.vertices.push(l, 0, i * space);
            geomStepsOne.vertices.push(i * space, 0, -l);
            geomStepsOne.vertices.push(i * space, 0, l);

            tc.push(0, 0, 0, 0, 0, 0, 0, 0);
        }

    if (!inCenter.get())
    {
        for (let i = 0; i < geomStepsOne.vertices.length; i += 3)
        {
            geomStepsOne.vertices[i + 0] += l;
            geomStepsOne.vertices[i + 1] += l;
        }
    }

    geomStepsOne.setTexCoords(tc);
    geomStepsOne.calculateNormals();

    if (!mesh) mesh = new CGL.Mesh(cgl, geomStepsOne);
    else mesh.setGeom(geomStepsOne);
}

render.onTriggered = function ()
{
    if (!mesh)init();
    let shader = cgl.getShader();
    if (!shader) return;

    let oldPrim = shader.glPrimitive;

    shader.glPrimitive = cgl.gl.LINES;

    mesh.render(shader);

    shader.glPrimitive = oldPrim;

    next.trigger();
};

}
};

CABLES.OPS["677a7c03-6885-46b4-8a64-e4ea54ee5d7f"]={f:Ops.Gl.Meshes.Grid,objName:"Ops.Gl.Meshes.Grid"};




// **************************************************************
// 
// Ops.Gl.Shader.WireframeMaterial_v2
// 
// **************************************************************

Ops.Gl.Shader.WireframeMaterial_v2= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={"wireframe_frag":"{{MODULES_HEAD}}\r\n\r\nIN vec3 barycentric;\r\nIN vec3 norm;\r\nUNI float width;\r\n\r\nUNI vec4 colorFill;\r\nUNI vec4 colorWire;\r\n\r\nUNI float aa;\r\n\r\nfloat edgeFactor()\r\n{\r\n    vec3 d = fwidth(barycentric);\r\n    vec3 a3 = smoothstep(vec3(0.0), d*width, barycentric);\r\n    return min(min(a3.x, a3.y), a3.z);\r\n}\r\n\r\nvoid main()\r\n{\r\n    vec4 col;\r\n    {{MODULE_BEGIN_FRAG}}\r\n\r\n\r\n    #ifdef WIREFRAME_FILL\r\n\r\n        float v=(1.0-edgeFactor())*(aa*width);\r\n        col = mix(colorFill,colorWire,v);\r\n\r\n    #endif\r\n\r\n    #ifndef WIREFRAME_FILL\r\n\r\n        float f=(1.0-edgeFactor())*(aa*width);\r\n        col = colorWire;\r\n        col.a=f;\r\n        if(f==0.0)discard;\r\n    #endif\r\n\r\n    {{MODULE_COLOR}}\r\n\r\n    outColor=col;\r\n}","wireframe_vert":"{{MODULES_HEAD}}\r\n\r\nIN vec3 vPosition;\r\nUNI mat4 projMatrix;\r\nUNI mat4 modelMatrix;\r\nUNI mat4 viewMatrix;\r\nOUT vec3 barycentric;\r\nIN vec2 attrTexCoord;\r\nOUT vec2 texCoord;\r\n\r\nIN vec3 attrBarycentric;\r\nIN vec3 attrVertNormal;\r\nOUT vec3 norm;\r\n\r\nvoid main()\r\n{\r\n    norm=attrVertNormal;\r\n    texCoord=attrTexCoord;\r\n    barycentric=attrBarycentric;\r\n    mat4 mMatrix=modelMatrix;\r\n    vec4 pos=vec4(vPosition, 1.0);\r\n\r\n    {{MODULE_VERTEX_POSITION}}\r\n\r\n    gl_Position = projMatrix * viewMatrix * mMatrix * pos;\r\n}\r\n",};
const
    render = op.inTrigger("render"),
    trigger = op.outTrigger("trigger"),
    enableDepth = op.inValueBool("enable depth testing", true),
    w = op.inFloat("width", 1),
    aa = op.inValueSlider("AntiAlias", 0.95),
    r = op.inValueSlider("diffuse r", 1),
    g = op.inValueSlider("diffuse g", 1),
    b = op.inValueSlider("diffuse b", 1),
    a = op.inValueSlider("diffuse A", 1),
    fill = op.inValueBool("fill", true),
    fr = op.inValueSlider("Fill R", 0.5),
    fg = op.inValueSlider("Fill G", 0.5),
    fb = op.inValueSlider("Fill B", 0.5),
    fa = op.inValueSlider("Fill A", 1);

op.setPortGroup("Color Wire", [r, g, b, a]);
op.setPortGroup("Color Fill", [fr, fg, fb, fa, fill]);
r.setUiAttribs({ "colorPick": true });
fr.setUiAttribs({ "colorPick": true });
fill.onChange = setDefines;

const cgl = op.patch.cgl;

function setDefines()
{
    if (shader) shader.toggleDefine("WIREFRAME_FILL", fill.get());

    fr.setUiAttribs({ "greyout": !fill.get() });
    fg.setUiAttribs({ "greyout": !fill.get() });
    fb.setUiAttribs({ "greyout": !fill.get() });
    fa.setUiAttribs({ "greyout": !fill.get() });
}



let doRender = function ()
{
    cgl.pushDepthTest(enableDepth.get());

    cgl.pushShader(shader);
    trigger.trigger();
    cgl.popShader();

    cgl.popDepthTest();
};

const shader = new CGL.Shader(cgl, "Wireframe Material");
const uniformWidth = new CGL.Uniform(shader, "f", "width", w);
const uniaa = new CGL.Uniform(shader, "f", "aa", aa);
const uni1 = new CGL.Uniform(shader, "4f", "colorFill", fr, fg, fb, fa);
const uni2 = new CGL.Uniform(shader, "4f", "colorWire", r, g, b, a);

shader.setModules(["MODULE_VERTEX_POSITION", "MODULE_COLOR", "MODULE_BEGIN_FRAG"]);
shader.setSource(attachments.wireframe_vert || "", attachments.wireframe_frag || "");
shader.wireframe = true;
setDefines();

if (cgl.glVersion == 1)
{
    if (!cgl.gl.getExtension("OES_standard_derivatives")) op.setUiError("noderivatives", "no standard derivatives extension available!");
    shader.enableExtension("OES_standard_derivatives");
}

render.onTriggered = doRender;

doRender();

}
};

CABLES.OPS["a8dfa4ef-8d81-4408-91e2-76b997bd7bd9"]={f:Ops.Gl.Shader.WireframeMaterial_v2,objName:"Ops.Gl.Shader.WireframeMaterial_v2"};




// **************************************************************
// 
// Ops.Trigger.TriggerSend
// 
// **************************************************************

Ops.Trigger.TriggerSend= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    trigger = op.inTriggerButton("Trigger"),
    next = op.outTrigger("Next");

op.varName = op.inValueSelect("Named Trigger", [], "", true);

op.varName.onChange = updateName;

trigger.onTriggered = doTrigger;

op.patch.addEventListener("namedTriggersChanged", updateVarNamesDropdown);

updateVarNamesDropdown();

op.varName.setUiAttribs({ "_triggerSelect": true });

function updateVarNamesDropdown()
{
    if (CABLES.UI)
    {
        let varnames = [];
        const vars = op.patch.namedTriggers;
        varnames.push("+ create new one");
        for (const i in vars) varnames.push(i);
        varnames = varnames.sort();
        op.varName.uiAttribs.values = varnames;
    }
}

function updateName()
{
    if (CABLES.UI)
    {
        if (op.varName.get() == "+ create new one")
        {
            new CABLES.UI.ModalDialog({
                "prompt": true,
                "title": "New Trigger",
                "text": "Enter a name for the new trigger",
                "promptValue": "",
                "promptOk": (str) =>
                {
                    op.varName.set(str);
                    op.patch.namedTriggers[str] = op.patch.namedTriggers[str] || [];
                    updateVarNamesDropdown();
                }
            });
            return;
        }

        op.refreshParams();
    }

    if (!op.patch.namedTriggers[op.varName.get()])
    {
        op.patch.namedTriggers[op.varName.get()] = op.patch.namedTriggers[op.varName.get()] || [];
        op.patch.emitEvent("namedTriggersChanged");
    }

    op.setTitle(">" + op.varName.get());

    op.refreshParams();
    op.patch.emitEvent("opTriggerNameChanged", op, op.varName.get());
}

function doTrigger()
{
    const arr = op.patch.namedTriggers[op.varName.get()];
    // fire an event even if noone is receiving this trigger
    // this way TriggerReceiveFilter can still handle it
    op.patch.emitEvent("namedTriggerSent", op.varName.get());

    if (!arr)
    {
        op.setUiError("unknowntrigger", "unknown trigger");
        return;
    }
    else op.setUiError("unknowntrigger", null);

    for (let i = 0; i < arr.length; i++)
    {
        arr[i]();
    }

    next.trigger();
}

}
};

CABLES.OPS["ce1eaf2b-943b-4dc0-ab5e-ee11b63c9ed0"]={f:Ops.Trigger.TriggerSend,objName:"Ops.Trigger.TriggerSend"};




// **************************************************************
// 
// Ops.Trigger.TriggerReceive
// 
// **************************************************************

Ops.Trigger.TriggerReceive= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const next = op.outTrigger("Triggered");
op.varName = op.inValueSelect("Named Trigger", [], "", true);

op.varName.setUiAttribs({ "_triggerSelect": true });

updateVarNamesDropdown();
op.patch.addEventListener("namedTriggersChanged", updateVarNamesDropdown);

let oldName = null;

function doTrigger()
{
    next.trigger();
}

function updateVarNamesDropdown()
{
    if (CABLES.UI)
    {
        let varnames = [];
        let vars = op.patch.namedTriggers;

        for (let i in vars) varnames.push(i);
        varnames = varnames.sort();
        op.varName.uiAttribs.values = varnames;
    }
}

op.varName.onChange = function ()
{
    if (oldName)
    {
        let oldCbs = op.patch.namedTriggers[oldName];
        let a = oldCbs.indexOf(doTrigger);
        if (a != -1) oldCbs.splice(a, 1);
    }

    op.setTitle(">" + op.varName.get());
    op.patch.namedTriggers[op.varName.get()] = op.patch.namedTriggers[op.varName.get()] || [];
    let cbs = op.patch.namedTriggers[op.varName.get()];

    cbs.push(doTrigger);
    oldName = op.varName.get();
    updateError();
    op.patch.emitEvent("opTriggerNameChanged", op, op.varName.get());
};

op.on("uiParamPanel", updateError);

function updateError()
{
    if (!op.varName.get())
    {
        op.setUiError("unknowntrigger", "unknown trigger");
    }
    else op.setUiError("unknowntrigger", null);
}

}
};

CABLES.OPS["0816c999-f2db-466b-9777-2814573574c5"]={f:Ops.Trigger.TriggerReceive,objName:"Ops.Trigger.TriggerReceive"};




// **************************************************************
// 
// Ops.Gl.RenderAnim_v2
// 
// **************************************************************

Ops.Gl.RenderAnim_v2= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    exec = op.inTrigger("Render"),
    next = op.outTrigger("Next"),
    inType = op.inDropDown("File Type", ["PNG", "JPG", "WebP", "WebM"], "PNG"),
    inZip = op.inBool("ZIP multiple files", false),
    inDownload = op.inBool("Download Files", true),
    inFilePrefix = op.inString("Filename", "cables"),
    inQuality = op.inFloatSlider("Quality", 0.8),
    inDurType = op.inSwitch("Duration Type", ["Seconds", "Frames"], "Seconds"),
    inDuration = op.inInt("Duration", 1),
    inFps = op.inInt("FPS", 30),
    inTransparency = op.inValueBool("Transparency", false),
    useCanvasSize = op.inValueBool("Use Canvas Size", true),
    inWidth = op.inValueInt("texture width", 512),
    inHeight = op.inValueInt("texture height", 512),
    inStart = op.inTriggerButton("Start"),
    outProgress = op.outNumber("Progress", 0),
    outFrame = op.outNumber("Frame", 0),
    outStatus = op.outString("Status", "Waiting"),
    outStarted = op.outBool("Started"),
    outUrl = op.outString("Data URL"),
    outFinished = op.outTrigger("Finished");

op.setPortGroup("File", [inType, inZip, inDownload, inFilePrefix, inQuality]);
op.setPortGroup("Size", [useCanvasSize, inWidth, inHeight]);
op.setPortGroup("Timing", [inFps, inDurType, inDuration]);

outUrl.ignoreValueSerialize = true;

exec.onTriggered = render;

let started = false;
let countFrames = 0;
const finished = true;
let fps = 30;
let numFrames = 31;

const cycle = false;
let shortId = CABLES.shortId();
let frameStarted = false;
const frames = [];
let lastFrame = -1;
let time = 0;

let filenamePrefix = "";

let zip = null;

let oldSizeW = op.patch.cgl.canvasWidth;
let oldSizeH = op.patch.cgl.canvasHeight;

inType.onChange = updateQuality;
useCanvasSize.onChange = updateSize;

updateQuality();
updateSize();

inZip.onChange = () =>
{
    zip = null;
};

function updateQuality()
{
    inQuality.setUiAttribs({ "greyout": inType.get() == "PNG" });
}

function updateSize()
{
    inWidth.setUiAttribs({ "greyout": useCanvasSize.get() });
    inHeight.setUiAttribs({ "greyout": useCanvasSize.get() });
}

inStart.onTriggered = function ()
{
    filenamePrefix = inFilePrefix.get();
    op.log("pref", filenamePrefix);
    frames.length = 0;
    outStatus.set("Starting");
    fps = inFps.get();
    numFrames = inDuration.get() * fps;
    if (inDurType.get() == "Frames")numFrames = inDuration.get();
    shortId = CABLES.shortId();
    updateTime();

    if (inZip.get()) zip = new JSZip();

    if (!useCanvasSize.get())
    {
        oldSizeW = CABLES.patch.cgl.canvasWidth;
        oldSizeH = CABLES.patch.cgl.canvasHeight;
        op.patch.cgl.setSize(inWidth.get() / CABLES.patch.cgl.pixelDensity, inHeight.get() / CABLES.patch.cgl.pixelDensity);
        op.patch.cgl.updateSize();
    }

    if (numFrames == 0)
    {
        countFrames = 0;
        started = true;
    }
    else
    {
        countFrames = -20;
        started = true;
        lastFrame = -9999;
    }
};

function updateTime()
{
    if (numFrames >= 0)
    {
        time = Math.max(0, countFrames * (1.0 / fps));
        op.patch.timer.setTime(time);
        CABLES.overwriteTime = time;// - 1 / fps;
        op.patch.freeTimer.setTime(time);
    }
}

function stopRendering()
{
    started = false;
    CABLES.overwriteTime = undefined;
    outStatus.set("Finished");
}

function render()
{
    outStarted.set(started);

    if (!started)
    {
        next.trigger();
        return;
    }

    const oldInternalNow = CABLES.internalNow;

    if (started)
    {
        CABLES.internalNow = function ()
        {
            return time * 1000;
        };

        updateTime();
        // CABLES.overwriteTime = time;
        // op.patch.timer.setTime(time);
        // op.patch.freeTimer.setTime(time);
    }

    if (lastFrame == countFrames)
    {
        next.trigger();
        return;
    }

    lastFrame = countFrames;

    let prog = countFrames / numFrames;
    if (prog < 0.0) prog = 0.0;
    outProgress.set(prog);
    outFrame.set(countFrames);

    next.trigger();

    CABLES.internalNow = oldInternalNow;

    frameStarted = false;
    if (countFrames > numFrames)
    {
        op.log("FINISHED...");
        op.log("ffmpeg -y -framerate 30 -f image2 -i " + filenamePrefix + "_%d.png  -b 9999k -vcodec mpeg4 " + shortId + ".mp4");

        if (!useCanvasSize.get())
        {
            op.patch.cgl.setSize(oldSizeW, oldSizeH);
            op.patch.cgl.updateSize();
        }

        if (zip)
        {
            zip.generateAsync({ "type": "blob" })
                .then(function (blob)
                {
                    const anchor = document.createElement("a");
                    anchor.download = filenamePrefix + ".zip";
                    anchor.href = URL.createObjectURL(blob);
                    if (inDownload.get())
                    {
                        anchor.click();
                    }
                    stopRendering();
                    if (outUrl.isLinked())
                    {
                        blobToDataURL(blob, (dataUrl) => { outUrl.set(dataUrl); outFinished.trigger(); });
                    }
                    else
                    {
                        outUrl.set(null);
                        outFinished.trigger();
                    }
                });
        }
        else
        if (inType.get() == "WebM")
        {
            try
            {
                outStatus.set("Creating Video File from frames");
                op.log("webm frames", frames.length);

                const video = Whammy.fromImageArray(frames, fps);
                const url = window.URL.createObjectURL(video);
                const anchor = document.createElement("a");

                anchor.setAttribute("download", filenamePrefix + ".webm");
                anchor.setAttribute("href", url);
                document.body.appendChild(anchor);
                if (inDownload.get())
                {
                    anchor.click();
                }
                stopRendering();
                if (outUrl.isLinked())
                {
                    blobToDataURL(video, (dataUrl) => { outUrl.set(dataUrl); outFinished.trigger(); });
                }
                else
                {
                    outUrl.set(null);
                    outFinished.trigger();
                }
            }
            catch (e)
            {
                op.logError(e);
            }

            frames.length = 0;
        }
        else
            stopRendering();

        return;
    }

    let mimetype = "image/png";
    let suffix = "png";

    if (inType.get() == "JPG")
    {
        mimetype = "image/jpeg";
        suffix = "jpg";
    }
    else if (inType.get() == "WebP")
    {
        mimetype = "image/webp";
        suffix = "webp";
    }

    if (countFrames > 0)
    {
        outStatus.set("Rendering Frame " + countFrames + " of " + numFrames);
        op.log("Rendering Frame " + countFrames + " of " + numFrames, time);
        if (inType.get() == "WebM")
        {
            frames.push(op.patch.cgl.canvas.toDataURL("image/webp", inQuality.get() * 0.999));
            countFrames++;
            updateTime();
        }
        else
        {
            op.log("screenshotting frame...", countFrames);
            op.patch.cgl.screenShot((blob) =>
            {
                if (blob)
                {
                    if (zip)
                    {
                        let filename = filenamePrefix + "_" + countFrames + "." + suffix;

                        zip.file(filename, blob, { "base64": false });
                        countFrames++;
                        updateTime();
                    }
                    else
                    {
                        let filename = filenamePrefix + "_" + shortId + "_" + countFrames + "." + suffix;

                        const anchor = document.createElement("a");
                        anchor.download = filename;
                        anchor.href = URL.createObjectURL(blob);

                        setTimeout(() =>
                        {
                            if (outUrl.isLinked())
                            {
                                blobToDataURL(blob, (dataUrl) => { outUrl.set(dataUrl); });
                            }
                            else
                            {
                                outUrl.set(null);
                            }
                            if (inDownload.get())
                            {
                                anchor.click();
                            }
                            countFrames++;
                            updateTime();
                        }, 200);
                    }
                }
                else
                {
                    op.log("screenshot: no blob");
                }
            }, !inTransparency.get(), mimetype, inQuality.get());
        }
    }
    else
    {
        outStatus.set("Prerendering...");
        op.log("pre ", countFrames, time);
        op.patch.cgl.screenShot((blob) =>
        {
            countFrames++;
            updateTime();
        });
    }
}

function blobToDataURL(blob, callback)
{
    let a = new FileReader();
    a.onload = function (e) { callback(e.target.result); };
    a.readAsDataURL(blob);
}

}
};

CABLES.OPS["c05e54a3-3ed5-4941-a412-01134f53f0ac"]={f:Ops.Gl.RenderAnim_v2,objName:"Ops.Gl.RenderAnim_v2"};




// **************************************************************
// 
// Ops.Gl.GLTF.GltfDracoCompression
// 
// **************************************************************

Ops.Gl.GLTF.GltfDracoCompression= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
class DracoDecoderClass
{
    constructor()
    {
        this.workerLimit = 4;
        this.workerPool = [];
        this.workerNextTaskID = 1;
        this.workerSourceURL = "";

        this.config = {
            "wasm": Uint8Array.from(atob(DracoDecoderWASM), (c) => { return c.charCodeAt(0); }),
            "wrapper": DracoWASMWrapperCode,
            "decoderSettings": {},
        };

        const dracoWorker = this._DracoWorker.toString();
        const workerCode = dracoWorker.substring(dracoWorker.indexOf("{") + 1, dracoWorker.lastIndexOf("}"));

        const jsContent = this.config.wrapper;
        const body = [
            "/* draco decoder */",
            jsContent,
            "",
            "/* worker */",
            workerCode
        ].join("\n");

        this.workerSourceURL = URL.createObjectURL(new Blob([body]));
    }

    _getWorker(taskID, taskCost)
    {
        if (this.workerPool.length < this.workerLimit)
        {
            const worker = new Worker(this.workerSourceURL);
            worker._callbacks = {};
            worker._taskCosts = {};
            worker._taskLoad = 0;
            worker.postMessage({ "type": "init", "decoderConfig": this.config });
            worker.onmessage = (e) =>
            {
                const message = e.data;

                switch (message.type)
                {
                case "done":
                    worker._callbacks[message.taskID].finishedCallback(message.geometry);
                    break;

                case "error":
                    worker._callbacks[message.taskID].errorCallback(message);
                    break;

                default:
                    op.error("THREE.DRACOLoader: Unexpected message, \"" + message.type + "\"");
                }
                this._releaseTask(worker, message.taskID);
            };
            this.workerPool.push(worker);
        }
        else
        {
            this.workerPool.sort(function (a, b)
            {
                return a._taskLoad > b._taskLoad ? -1 : 1;
            });
        }

        const worker = this.workerPool[this.workerPool.length - 1];
        worker._taskCosts[taskID] = taskCost;
        worker._taskLoad += taskCost;
        return worker;
    }

    decodeGeometry(buffer, finishedCallback, errorCallback = null)
    {
        const taskID = this.workerNextTaskID++;
        const taskCost = buffer.byteLength;

        const worker = this._getWorker(taskID, taskCost);
        worker._callbacks[taskID] = { finishedCallback, errorCallback };
        worker.postMessage({ "type": "decode", "taskID": taskID, buffer }, [buffer]);
    }

    _releaseTask(worker, taskID)
    {
        worker._taskLoad -= worker._taskCosts[taskID];
        delete worker._callbacks[taskID];
        delete worker._taskCosts[taskID];
    }

    _DracoWorker()
    {
        let pendingDecoder;

        onmessage = function (e)
        {
            const message = e.data;
            switch (message.type)
            {
            case "init":
                const decoderConfig = message.decoderConfig;
                const moduleConfig = decoderConfig.decoderSettings;
                pendingDecoder = new Promise(function (resolve)
                {
                    moduleConfig.onModuleLoaded = function (draco)
                    {
                        // Module is Promise-like. Wrap before resolving to avoid loop.
                        resolve({ "draco": draco });
                    };
                    moduleConfig.wasmBinary = decoderConfig.wasm;
                    DracoDecoderModule(moduleConfig); // eslint-disable-line no-undef
                });
                break;
            case "decode":
                pendingDecoder.then((module) =>
                {
                    const draco = module.draco;

                    const f = new draco.Decoder();
                    const dataBuff = new Int8Array(message.buffer);

                    const geometryType = f.GetEncodedGeometryType(dataBuff);
                    const buffer = new draco.DecoderBuffer();
                    buffer.Init(dataBuff, dataBuff.byteLength);

                    let outputGeometry = new draco.Mesh();
                    const status = f.DecodeBufferToMesh(buffer, outputGeometry);
                    const attribute = f.GetAttributeByUniqueId(outputGeometry, 1);
                    const geometry = dracoAttributes(draco, f, outputGeometry, geometryType, name);

                    this.postMessage({ "type": "done", "taskID": message.taskID, "geometry": geometry });

                    draco.destroy(f);
                    draco.destroy(buffer);
                });
                break;
            }
        };

        let dracoAttributes = function (draco, decoder, dracoGeometry, geometryType, name)
        {
            const attributeIDs = {
                "position": draco.POSITION,
                "normal": draco.NORMAL,
                "color": draco.COLOR,
                "uv": draco.TEX_COORD,
                "joints": draco.GENERIC,
                "weights": draco.GENERIC,
            };
            const attributeTypes = {
                "position": "Float32Array",
                "normal": "Float32Array",
                "color": "Float32Array",
                "weights": "Float32Array",
                "joints": "Uint8Array",
                "uv": "Float32Array"
            };

            const geometry = {
                "index": null,
                "attributes": []
            };

            let count = 0;
            for (const attributeName in attributeIDs)
            {
                const attributeType = attributeTypes[attributeName];
                let attributeID = decoder.GetAttributeId(dracoGeometry, attributeIDs[attributeName]);

                count++;
                if (attributeID != -1)
                {
                    let attribute = decoder.GetAttribute(dracoGeometry, attributeID);
                    geometry.attributes.push(decodeAttribute(draco, decoder, dracoGeometry, attributeName, attributeType, attribute));
                }
            }

            if (geometryType === draco.TRIANGULAR_MESH) geometry.index = decodeIndex(draco, decoder, dracoGeometry);
            else op.warn("unknown draco geometryType", geometryType);

            draco.destroy(dracoGeometry);
            return geometry;
        };

        let decodeIndex = function (draco, decoder, dracoGeometry)
        {
            const numFaces = dracoGeometry.num_faces();
            const numIndices = numFaces * 3;
            const byteLength = numIndices * 4;
            const ptr = draco._malloc(byteLength);

            decoder.GetTrianglesUInt32Array(dracoGeometry, byteLength, ptr);
            const index = new Uint32Array(draco.HEAPF32.buffer, ptr, numIndices).slice();

            draco._free(ptr);

            return {
                "array": index,
                "itemSize": 1
            };
        };

        let decodeAttribute = function (draco, decoder, dracoGeometry, attributeName, attributeType, attribute)
        {
            let bytesPerElement = 4;
            if (attributeType === "Float32Array") bytesPerElement = 4;
            else if (attributeType === "Uint8Array") bytesPerElement = 1;
            else op.warn("unknown attrtype bytesPerElement", attributeType);

            const numComponents = attribute.num_components();
            const numPoints = dracoGeometry.num_points();
            const numValues = numPoints * numComponents;
            const byteLength = numValues * bytesPerElement;
            const dataType = getDracoDataType(draco, attributeType);
            const ptr = draco._malloc(byteLength);
            let array = null;

            decoder.GetAttributeDataArrayForAllPoints(dracoGeometry, attribute, dataType, byteLength, ptr);

            if (attributeType === "Float32Array") array = new Float32Array(draco.HEAPF32.buffer, ptr, numValues).slice();
            else if (attributeType === "Uint8Array") array = new Uint8Array(draco.HEAPF32.buffer, ptr, numValues).slice();
            else op.warn("unknown attrtype", attributeType);

            draco._free(ptr);

            return {
                "name": attributeName,
                "array": array,
                "itemSize": numComponents
            };
        };

        let getDracoDataType = function (draco, attributeType)
        {
            switch (attributeType)
            {
            case "Float32Array": return draco.DT_FLOAT32;
            case "Int8Array": return draco.DT_INT8;
            case "Int16Array": return draco.DT_INT16;
            case "Int32Array": return draco.DT_INT32;
            case "Uint8Array": return draco.DT_UINT8;
            case "Uint16Array": return draco.DT_UINT16;
            case "Uint32Array": return draco.DT_UINT32;
            }
        };
    }
}

window.DracoDecoder = new DracoDecoderClass();

}
};

CABLES.OPS["4ecdc2ef-a242-4548-ad74-13f617119a64"]={f:Ops.Gl.GLTF.GltfDracoCompression,objName:"Ops.Gl.GLTF.GltfDracoCompression"};




// **************************************************************
// 
// Ops.Gl.GLTF.GltfScene_v4
// 
// **************************************************************

Ops.Gl.GLTF.GltfScene_v4= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={"inc_camera_js":"const gltfCamera = class\r\n{\r\n    constructor(gltf, node)\r\n    {\r\n        this.node = node;\r\n        this.name = node.name;\r\n        // console.log(gltf);\r\n        this.config = gltf.json.cameras[node.camera];\r\n\r\n        this.pos = vec3.create();\r\n        this.quat = quat.create();\r\n        this.vCenter = vec3.create();\r\n        this.vUp = vec3.create();\r\n        this.vMat = mat4.create();\r\n    }\r\n\r\n    updateAnim(time)\r\n    {\r\n        if (this.node && this.node._animTrans)\r\n        {\r\n            vec3.set(this.pos,\r\n                this.node._animTrans[0].getValue(time),\r\n                this.node._animTrans[1].getValue(time),\r\n                this.node._animTrans[2].getValue(time));\r\n\r\n            quat.set(this.quat,\r\n                this.node._animRot[0].getValue(time),\r\n                this.node._animRot[1].getValue(time),\r\n                this.node._animRot[2].getValue(time),\r\n                this.node._animRot[3].getValue(time));\r\n        }\r\n    }\r\n\r\n    start(time)\r\n    {\r\n        if (cgl.tempData.shadowPass) return;\r\n\r\n        this.updateAnim(time);\r\n        const asp = cgl.getViewPort()[2] / cgl.getViewPort()[3];\r\n\r\n        cgl.pushPMatrix();\r\n        // mat4.perspective(\r\n        //     cgl.pMatrix,\r\n        //     this.config.perspective.yfov*0.5,\r\n        //     asp,\r\n        //     this.config.perspective.znear,\r\n        //     this.config.perspective.zfar);\r\n\r\n        cgl.pushViewMatrix();\r\n        // mat4.identity(cgl.vMatrix);\r\n\r\n        // if(this.node && this.node.parent)\r\n        // {\r\n        //     console.log(this.node.parent)\r\n        // vec3.add(this.pos,this.pos,this.node.parent._node.translation);\r\n        // vec3.sub(this.vCenter,this.vCenter,this.node.parent._node.translation);\r\n        // mat4.translate(cgl.vMatrix,cgl.vMatrix,\r\n        // [\r\n        //     -this.node.parent._node.translation[0],\r\n        //     -this.node.parent._node.translation[1],\r\n        //     -this.node.parent._node.translation[2]\r\n        // ])\r\n        // }\r\n\r\n        // vec3.set(this.vUp, 0, 1, 0);\r\n        // vec3.set(this.vCenter, 0, -1, 0);\r\n        // // vec3.set(this.vCenter, 0, 1, 0);\r\n        // vec3.transformQuat(this.vCenter, this.vCenter, this.quat);\r\n        // vec3.normalize(this.vCenter, this.vCenter);\r\n        // vec3.add(this.vCenter, this.vCenter, this.pos);\r\n\r\n        // mat4.lookAt(cgl.vMatrix, this.pos, this.vCenter, this.vUp);\r\n\r\n        let mv = mat4.create();\r\n        mat4.invert(mv, this.node.modelMatAbs());\r\n\r\n        // console.log(this.node.modelMatAbs());\r\n\r\n        this.vMat = mv;\r\n\r\n        mat4.identity(cgl.vMatrix);\r\n        // console.log(mv);\r\n        mat4.mul(cgl.vMatrix, cgl.vMatrix, mv);\r\n    }\r\n\r\n    end()\r\n    {\r\n        if (cgl.tempData.shadowPass) return;\r\n        cgl.popPMatrix();\r\n        cgl.popViewMatrix();\r\n    }\r\n};\r\n","inc_gltf_js":"const le = true; // little endian\r\n\r\nconst Gltf = class\r\n{\r\n    constructor()\r\n    {\r\n        this.json = {};\r\n        this.accBuffers = [];\r\n        this.meshes = [];\r\n        this.nodes = [];\r\n        this.shaders = [];\r\n        this.timing = [];\r\n        this.cams = [];\r\n        this.startTime = performance.now();\r\n        this.bounds = new CABLES.CG.BoundingBox();\r\n        this.loaded = Date.now();\r\n        this.accBuffersDelete = [];\r\n    }\r\n\r\n    getNode(n)\r\n    {\r\n        for (let i = 0; i < this.nodes.length; i++)\r\n        {\r\n            if (this.nodes[i].name == n) return this.nodes[i];\r\n        }\r\n    }\r\n\r\n    unHideAll()\r\n    {\r\n        for (let i = 0; i < this.nodes.length; i++)\r\n        {\r\n            this.nodes[i].unHide();\r\n        }\r\n    }\r\n};\r\n\r\nfunction Utf8ArrayToStr(array)\r\n{\r\n    if (window.TextDecoder) return new TextDecoder(\"utf-8\").decode(array);\r\n\r\n    let out, i, len, c;\r\n    let char2, char3;\r\n\r\n    out = \"\";\r\n    len = array.length;\r\n    i = 0;\r\n    while (i < len)\r\n    {\r\n        c = array[i++];\r\n        switch (c >> 4)\r\n        {\r\n        case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:\r\n            // 0xxxxxxx\r\n            out += String.fromCharCode(c);\r\n            break;\r\n        case 12: case 13:\r\n            // 110x xxxx   10xx xxxx\r\n            char2 = array[i++];\r\n            out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));\r\n            break;\r\n        case 14:\r\n            // 1110 xxxx  10xx xxxx  10xx xxxx\r\n            char2 = array[i++];\r\n            char3 = array[i++];\r\n            out += String.fromCharCode(((c & 0x0F) << 12) |\r\n                    ((char2 & 0x3F) << 6) |\r\n                    ((char3 & 0x3F) << 0));\r\n            break;\r\n        }\r\n    }\r\n\r\n    return out;\r\n}\r\n\r\nfunction readChunk(dv, bArr, arrayBuffer, offset)\r\n{\r\n    const chunk = {};\r\n\r\n    if (offset >= dv.byteLength)\r\n    {\r\n        // op.log(\"could not read chunk...\");\r\n        return;\r\n    }\r\n    chunk.size = dv.getUint32(offset + 0, le);\r\n\r\n    // chunk.type = new TextDecoder(\"utf-8\").decode(bArr.subarray(offset+4, offset+4+4));\r\n    chunk.type = Utf8ArrayToStr(bArr.subarray(offset + 4, offset + 4 + 4));\r\n\r\n    if (chunk.type == \"BIN\\0\")\r\n    {\r\n        // console.log(chunk.size,arrayBuffer.length,offset);\r\n        // try\r\n        // {\r\n        chunk.dataView = new DataView(arrayBuffer, offset + 8, chunk.size);\r\n        // }\r\n        // catch(e)\r\n        // {\r\n        //     chunk.dataView = null;\r\n        //     console.log(e);\r\n        // }\r\n    }\r\n    else\r\n    if (chunk.type == \"JSON\")\r\n    {\r\n        const json = Utf8ArrayToStr(bArr.subarray(offset + 8, offset + 8 + chunk.size));\r\n\r\n        try\r\n        {\r\n            const obj = JSON.parse(json);\r\n            chunk.data = obj;\r\n            outGenerator.set(obj.asset.generator);\r\n        }\r\n        catch (e)\r\n        {\r\n        }\r\n    }\r\n    else\r\n    {\r\n        op.warn(\"unknown type\", chunk.type);\r\n    }\r\n\r\n    return chunk;\r\n}\r\n\r\nfunction loadAnims(gltf)\r\n{\r\n    const uniqueAnimNames = {};\r\n    maxTimeDict = {};\r\n\r\n    for (let i = 0; i < gltf.json.animations.length; i++)\r\n    {\r\n        const an = gltf.json.animations[i];\r\n\r\n        an.name = an.name || \"unknown\";\r\n\r\n        for (let ia = 0; ia < an.channels.length; ia++)\r\n        {\r\n            const chan = an.channels[ia];\r\n\r\n            const node = gltf.nodes[chan.target.node];\r\n            const sampler = an.samplers[chan.sampler];\r\n\r\n            const acc = gltf.json.accessors[sampler.input];\r\n            const bufferIn = gltf.accBuffers[sampler.input];\r\n\r\n            const accOut = gltf.json.accessors[sampler.output];\r\n            const bufferOut = gltf.accBuffers[sampler.output];\r\n\r\n            gltf.accBuffersDelete.push(sampler.output, sampler.input);\r\n\r\n            if (bufferIn && bufferOut)\r\n            {\r\n                let numComps = 1;\r\n                if (accOut.type === \"VEC2\")numComps = 2;\r\n                else if (accOut.type === \"VEC3\")numComps = 3;\r\n                else if (accOut.type === \"VEC4\")numComps = 4;\r\n                else if (accOut.type === \"SCALAR\")\r\n                {\r\n                    numComps = bufferOut.length / bufferIn.length; // is this really the way to find out ? cant find any other way,except number of morph targets, but not really connected...\r\n                }\r\n                else op.log(\"[] UNKNOWN accOut.type\", accOut.type);\r\n\r\n                const anims = [];\r\n\r\n                uniqueAnimNames[an.name] = true;\r\n\r\n                for (let k = 0; k < numComps; k++)\r\n                {\r\n                    const newAnim = new CABLES.Anim();\r\n                    // newAnim.name=an.name;\r\n                    anims.push(newAnim);\r\n                }\r\n\r\n                if (sampler.interpolation === \"LINEAR\") {}\r\n                else if (sampler.interpolation === \"STEP\") for (let k = 0; k < numComps; k++) anims[k].defaultEasing = CABLES.EASING_ABSOLUTE;\r\n                else if (sampler.interpolation === \"CUBICSPLINE\") for (let k = 0; k < numComps; k++) anims[k].defaultEasing = CABLES.EASING_CUBICSPLINE;\r\n                else op.warn(\"unknown interpolation\", sampler.interpolation);\r\n\r\n                // console.log(bufferOut)\r\n\r\n                // if there is no keyframe for time 0 copy value of first keyframe at time 0\r\n                if (bufferIn[0] !== 0.0)\r\n                    for (let k = 0; k < numComps; k++)\r\n                        anims[k].setValue(0, bufferOut[0 * numComps + k]);\r\n\r\n                for (let j = 0; j < bufferIn.length; j++)\r\n                {\r\n                    // maxTime = Math.max(bufferIn[j], maxTime);\r\n                    maxTimeDict[an.name] = bufferIn[j];\r\n\r\n                    for (let k = 0; k < numComps; k++)\r\n                    {\r\n                        if (anims[k].defaultEasing === CABLES.EASING_CUBICSPLINE)\r\n                        {\r\n                            const idx = ((j * numComps) * 3 + k);\r\n\r\n                            const key = anims[k].setValue(bufferIn[j], bufferOut[idx + numComps]);\r\n                            key.bezTangIn = bufferOut[idx];\r\n                            key.bezTangOut = bufferOut[idx + (numComps * 2)];\r\n\r\n                            // console.log(an.name,k,bufferOut[idx+1]);\r\n                        }\r\n                        else\r\n                        {\r\n                            // console.log(an.name,k,bufferOut[j * numComps + k]);\r\n                            anims[k].setValue(bufferIn[j], bufferOut[j * numComps + k]);\r\n                        }\r\n                    }\r\n                }\r\n\r\n                node.setAnim(chan.target.path, an.name, anims);\r\n            }\r\n            else\r\n            {\r\n                op.warn(\"loadAmins bufferIn undefined \", bufferIn === undefined);\r\n                op.warn(\"loadAmins bufferOut undefined \", bufferOut === undefined);\r\n                op.warn(\"loadAmins \", an.name, sampler, accOut);\r\n                op.warn(\"loadAmins num accBuffers\", gltf.accBuffers.length);\r\n                op.warn(\"loadAmins num accessors\", gltf.json.accessors.length);\r\n            }\r\n        }\r\n    }\r\n\r\n    gltf.uniqueAnimNames = uniqueAnimNames;\r\n\r\n    outAnims.setRef(Object.keys(uniqueAnimNames));\r\n}\r\n\r\nfunction loadCams(gltf)\r\n{\r\n    if (!gltf || !gltf.json.cameras) return;\r\n\r\n    gltf.cameras = gltf.cameras || [];\r\n\r\n    for (let i = 0; i < gltf.nodes.length; i++)\r\n    {\r\n        if (gltf.nodes[i].hasOwnProperty(\"camera\"))\r\n        {\r\n            const cam = new gltfCamera(gltf, gltf.nodes[i]);\r\n            gltf.cameras.push(cam);\r\n        }\r\n    }\r\n}\r\n\r\nfunction loadAfterDraco()\r\n{\r\n    if (!window.DracoDecoder)\r\n    {\r\n        setTimeout(() =>\r\n        {\r\n            loadAfterDraco();\r\n        }, 100);\r\n    }\r\n\r\n    reloadSoon();\r\n}\r\n\r\nfunction parseGltf(arrayBuffer)\r\n{\r\n    const CHUNK_HEADER_SIZE = 8;\r\n\r\n    let j = 0, i = 0;\r\n\r\n    const gltf = new Gltf();\r\n    gltf.timing.push([\"Start parsing\", Math.round((performance.now() - gltf.startTime))]);\r\n\r\n    if (!arrayBuffer) return;\r\n    const byteArray = new Uint8Array(arrayBuffer);\r\n    let pos = 0;\r\n\r\n    // var string = new TextDecoder(\"utf-8\").decode(byteArray.subarray(pos, 4));\r\n    const string = Utf8ArrayToStr(byteArray.subarray(pos, 4));\r\n    pos += 4;\r\n    if (string != \"glTF\") return;\r\n\r\n    gltf.timing.push([\"dataview\", Math.round((performance.now() - gltf.startTime))]);\r\n\r\n    const dv = new DataView(arrayBuffer);\r\n    const version = dv.getUint32(pos, le);\r\n    pos += 4;\r\n    const size = dv.getUint32(pos, le);\r\n    pos += 4;\r\n\r\n    outVersion.set(version);\r\n\r\n    const chunks = [];\r\n    gltf.chunks = chunks;\r\n\r\n    chunks.push(readChunk(dv, byteArray, arrayBuffer, pos));\r\n    pos += chunks[0].size + CHUNK_HEADER_SIZE;\r\n    gltf.json = chunks[0].data;\r\n\r\n    gltf.cables = {\r\n        \"fileUrl\": inFile.get(),\r\n        \"shortFileName\": CABLES.basename(inFile.get())\r\n    };\r\n\r\n    outJson.setRef(gltf.json);\r\n    outExtensions.setRef(gltf.json.extensionsUsed || []);\r\n\r\n    let ch = readChunk(dv, byteArray, arrayBuffer, pos);\r\n    while (ch)\r\n    {\r\n        chunks.push(ch);\r\n        pos += ch.size + CHUNK_HEADER_SIZE;\r\n        ch = readChunk(dv, byteArray, arrayBuffer, pos);\r\n    }\r\n\r\n    gltf.chunks = chunks;\r\n\r\n    const views = chunks[0].data.bufferViews;\r\n    const accessors = chunks[0].data.accessors;\r\n\r\n    gltf.timing.push([\"Parse buffers\", Math.round((performance.now() - gltf.startTime))]);\r\n\r\n    if (gltf.json.extensionsUsed && gltf.json.extensionsUsed.indexOf(\"KHR_draco_mesh_compression\") > -1)\r\n    {\r\n        if (!window.DracoDecoder)\r\n        {\r\n            op.setUiError(\"gltfdraco\", \"GLTF draco compression lib not found / add draco op to your patch!\");\r\n\r\n            loadAfterDraco();\r\n            return gltf;\r\n        }\r\n        else\r\n        {\r\n            gltf.useDraco = true;\r\n        }\r\n    }\r\n\r\n    op.setUiError(\"gltfdraco\", null);\r\n    // let accPos = (view.byteOffset || 0) + (acc.byteOffset || 0);\r\n\r\n    if (views)\r\n    {\r\n        for (i = 0; i < accessors.length; i++)\r\n        {\r\n            const acc = accessors[i];\r\n            const view = views[acc.bufferView];\r\n\r\n            let numComps = 0;\r\n            if (acc.type == \"SCALAR\")numComps = 1;\r\n            else if (acc.type == \"VEC2\")numComps = 2;\r\n            else if (acc.type == \"VEC3\")numComps = 3;\r\n            else if (acc.type == \"VEC4\")numComps = 4;\r\n            else if (acc.type == \"MAT4\")numComps = 16;\r\n            else console.error(\"unknown accessor type\", acc.type);\r\n\r\n            //   const decoder = new decoderModule.Decoder();\r\n            //   const decodedGeometry = decodeDracoData(data, decoder);\r\n            //   // Encode mesh\r\n            //   encodeMeshToFile(decodedGeometry, decoder);\r\n\r\n            //   decoderModule.destroy(decoder);\r\n            //   decoderModule.destroy(decodedGeometry);\r\n\r\n            // 5120 (BYTE)\t1\r\n            // 5121 (UNSIGNED_BYTE)\t1\r\n            // 5122 (SHORT)\t2\r\n\r\n            if (chunks[1].dataView)\r\n            {\r\n                if (view)\r\n                {\r\n                    const num = acc.count * numComps;\r\n                    let accPos = (view.byteOffset || 0) + (acc.byteOffset || 0);\r\n                    let stride = view.byteStride || 0;\r\n                    let dataBuff = null;\r\n\r\n                    if (acc.componentType == 5126 || acc.componentType == 5125) // 4byte FLOAT or INT\r\n                    {\r\n                        stride = stride || 4;\r\n\r\n                        const isInt = acc.componentType == 5125;\r\n                        if (isInt)dataBuff = new Uint32Array(num);\r\n                        else dataBuff = new Float32Array(num);\r\n\r\n                        dataBuff.cblStride = numComps;\r\n\r\n                        for (j = 0; j < num; j++)\r\n                        {\r\n                            if (isInt) dataBuff[j] = chunks[1].dataView.getUint32(accPos, le);\r\n                            else dataBuff[j] = chunks[1].dataView.getFloat32(accPos, le);\r\n\r\n                            if (stride != 4 && (j + 1) % numComps === 0)accPos += stride - (numComps * 4);\r\n                            accPos += 4;\r\n                        }\r\n                    }\r\n                    else if (acc.componentType == 5123) // UNSIGNED_SHORT\r\n                    {\r\n                        stride = stride || 2;\r\n\r\n                        dataBuff = new Uint16Array(num);\r\n                        dataBuff.cblStride = stride;\r\n\r\n                        for (j = 0; j < num; j++)\r\n                        {\r\n                            dataBuff[j] = chunks[1].dataView.getUint16(accPos, le);\r\n\r\n                            if (stride != 2 && (j + 1) % numComps === 0) accPos += stride - (numComps * 2);\r\n\r\n                            accPos += 2;\r\n                        }\r\n                    }\r\n                    else if (acc.componentType == 5121) // UNSIGNED_BYTE\r\n                    {\r\n                        stride = stride || 1;\r\n\r\n                        dataBuff = new Uint8Array(num);\r\n                        dataBuff.cblStride = stride;\r\n\r\n                        for (j = 0; j < num; j++)\r\n                        {\r\n                            dataBuff[j] = chunks[1].dataView.getUint8(accPos, le);\r\n\r\n                            if (stride != 1 && (j + 1) % numComps === 0) accPos += stride - (numComps * 1);\r\n\r\n                            accPos += 1;\r\n                        }\r\n                    }\r\n\r\n                    else\r\n                    {\r\n                        console.error(\"unknown component type\", acc.componentType);\r\n                    }\r\n\r\n                    gltf.accBuffers.push(dataBuff);\r\n                }\r\n                else\r\n                {\r\n                    // console.log(\"has no dataview\");\r\n                }\r\n            }\r\n        }\r\n    }\r\n\r\n    gltf.timing.push([\"Parse mesh groups\", Math.round((performance.now() - gltf.startTime))]);\r\n\r\n    gltf.json.meshes = gltf.json.meshes || [];\r\n\r\n    if (gltf.json.meshes)\r\n    {\r\n        for (i = 0; i < gltf.json.meshes.length; i++)\r\n        {\r\n            const mesh = new gltfMeshGroup(gltf, gltf.json.meshes[i]);\r\n            gltf.meshes.push(mesh);\r\n        }\r\n    }\r\n\r\n    gltf.timing.push([\"Parse nodes\", Math.round((performance.now() - gltf.startTime))]);\r\n\r\n    for (i = 0; i < gltf.json.nodes.length; i++)\r\n    {\r\n        if (gltf.json.nodes[i].children)\r\n            for (j = 0; j < gltf.json.nodes[i].children.length; j++)\r\n            {\r\n                gltf.json.nodes[gltf.json.nodes[i].children[j]].isChild = true;\r\n            }\r\n    }\r\n\r\n    for (i = 0; i < gltf.json.nodes.length; i++)\r\n    {\r\n        const node = new gltfNode(gltf.json.nodes[i], gltf);\r\n        gltf.nodes.push(node);\r\n    }\r\n\r\n    for (i = 0; i < gltf.nodes.length; i++)\r\n    {\r\n        const node = gltf.nodes[i];\r\n\r\n        if (!node.children) continue;\r\n        for (let j = 0; j < node.children.length; j++)\r\n        {\r\n            gltf.nodes[node.children[j]].parent = node;\r\n        }\r\n    }\r\n\r\n    for (i = 0; i < gltf.nodes.length; i++)\r\n    {\r\n        gltf.nodes[i].initSkin();\r\n    }\r\n\r\n    needsMatUpdate = true;\r\n\r\n    gltf.timing.push([\"load anims\", Math.round((performance.now() - gltf.startTime))]);\r\n\r\n    if (gltf.json.animations) loadAnims(gltf);\r\n\r\n    gltf.timing.push([\"load cameras\", Math.round((performance.now() - gltf.startTime))]);\r\n\r\n    if (gltf.json.cameras) loadCams(gltf);\r\n\r\n    gltf.timing.push([\"finished\", Math.round((performance.now() - gltf.startTime))]);\r\n    return gltf;\r\n}\r\n","inc_mesh_js":"let gltfMesh = class\r\n{\r\n    constructor(name, prim, gltf, finished)\r\n    {\r\n        this.POINTS = 0;\r\n        this.LINES = 1;\r\n        this.LINE_LOOP = 2;\r\n        this.LINE_STRIP = 3;\r\n        this.TRIANGLES = 4;\r\n        this.TRIANGLE_STRIP = 5;\r\n        this.TRIANGLE_FAN = 6;\r\n\r\n        this.test = 0;\r\n        this.name = name;\r\n        this.submeshIndex = 0;\r\n        this.material = prim.material;\r\n        this.mesh = null;\r\n        this.geom = new CGL.Geometry(\"gltf_\" + this.name);\r\n        this.geom.verticesIndices = [];\r\n        this.bounds = null;\r\n        this.primitive = 4;\r\n        this.morphTargetsRenderMod = null;\r\n        this.weights = prim.weights;\r\n\r\n        if (prim.hasOwnProperty(\"mode\")) this.primitive = prim.mode;\r\n\r\n        if (prim.hasOwnProperty(\"indices\")) this.geom.verticesIndices = gltf.accBuffers[prim.indices];\r\n\r\n        gltf.loadingMeshes = gltf.loadingMeshes || 0;\r\n        gltf.loadingMeshes++;\r\n\r\n        this.materialJson =\r\n            this._matPbrMetalness =\r\n            this._matPbrRoughness =\r\n            this._matDiffuseColor = null;\r\n\r\n        if (gltf.json.materials)\r\n        {\r\n            if (this.material != -1) this.materialJson = gltf.json.materials[this.material];\r\n\r\n            if (this.materialJson && this.materialJson.pbrMetallicRoughness)\r\n            {\r\n                if (!this.materialJson.pbrMetallicRoughness.hasOwnProperty(\"baseColorFactor\"))\r\n                {\r\n                    this._matDiffuseColor = [1, 1, 1, 1];\r\n                }\r\n                else\r\n                {\r\n                    this._matDiffuseColor = this.materialJson.pbrMetallicRoughness.baseColorFactor;\r\n                }\r\n\r\n                this._matDiffuseColor = this.materialJson.pbrMetallicRoughness.baseColorFactor;\r\n\r\n                if (!this.materialJson.pbrMetallicRoughness.hasOwnProperty(\"metallicFactor\"))\r\n                {\r\n                    this._matPbrMetalness = 1.0;\r\n                }\r\n                else\r\n                {\r\n                    this._matPbrMetalness = this.materialJson.pbrMetallicRoughness.metallicFactor || null;\r\n                }\r\n\r\n                if (!this.materialJson.pbrMetallicRoughness.hasOwnProperty(\"roughnessFactor\"))\r\n                {\r\n                    this._matPbrRoughness = 1.0;\r\n                }\r\n                else\r\n                {\r\n                    this._matPbrRoughness = this.materialJson.pbrMetallicRoughness.roughnessFactor || null;\r\n                }\r\n            }\r\n        }\r\n\r\n        if (gltf.useDraco && prim.extensions.KHR_draco_mesh_compression)\r\n        {\r\n            const view = gltf.chunks[0].data.bufferViews[prim.extensions.KHR_draco_mesh_compression.bufferView];\r\n            const num = view.byteLength;\r\n            const dataBuff = new Int8Array(num);\r\n            let accPos = (view.byteOffset || 0);// + (acc.byteOffset || 0);\r\n            for (let j = 0; j < num; j++)\r\n            {\r\n                dataBuff[j] = gltf.chunks[1].dataView.getInt8(accPos, le);\r\n                accPos++;\r\n            }\r\n\r\n            const dracoDecoder = window.DracoDecoder;\r\n            dracoDecoder.decodeGeometry(dataBuff.buffer, (geometry) =>\r\n            {\r\n                const geom = new CGL.Geometry(\"draco mesh \" + name);\r\n\r\n                for (let i = 0; i < geometry.attributes.length; i++)\r\n                {\r\n                    const attr = geometry.attributes[i];\r\n\r\n                    if (attr.name === \"position\") geom.vertices = attr.array;\r\n                    else if (attr.name === \"normal\") geom.vertexNormals = attr.array;\r\n                    else if (attr.name === \"uv\") geom.texCoords = attr.array;\r\n                    else if (attr.name === \"color\") geom.vertexColors = this.calcVertexColors(attr.array);\r\n                    else if (attr.name === \"joints\") geom.setAttribute(\"attrJoints\", Array.from(attr.array), 4);\r\n                    else if (attr.name === \"weights\")\r\n                    {\r\n                        const arr4 = new Float32Array(attr.array.length / attr.itemSize * 4);\r\n\r\n                        for (let k = 0; k < attr.array.length / attr.itemSize; k++)\r\n                        {\r\n                            arr4[k * 4] = arr4[k * 4 + 1] = arr4[k * 4 + 2] = arr4[k * 4 + 3] = 0;\r\n                            for (let j = 0; j < attr.itemSize; j++)\r\n                                arr4[k * 4 + j] = attr.array[k * attr.itemSize + j];\r\n                        }\r\n                        geom.setAttribute(\"attrWeights\", arr4, 4);\r\n                    }\r\n                    else op.logWarn(\"unknown draco attrib\", attr);\r\n                }\r\n\r\n                geometry.attributes = null;\r\n                geom.verticesIndices = geometry.index.array;\r\n\r\n                this.setGeom(geom);\r\n\r\n                this.mesh = null;\r\n                gltf.loadingMeshes--;\r\n                gltf.timing.push([\"draco decode\", Math.round((performance.now() - gltf.startTime))]);\r\n\r\n                if (finished)finished(this);\r\n            }, (error) => { op.logError(error); });\r\n        }\r\n        else\r\n        {\r\n            gltf.loadingMeshes--;\r\n            this.fillGeomAttribs(gltf, this.geom, prim.attributes);\r\n\r\n            if (prim.targets)\r\n            {\r\n                for (let j = 0; j < prim.targets.length; j++)\r\n                {\r\n                    const tgeom = new CGL.Geometry(\"gltf_target_\" + j);\r\n\r\n                    // if (prim.hasOwnProperty(\"indices\")) tgeom.verticesIndices = gltf.accBuffers[prim.indices];\r\n\r\n                    this.fillGeomAttribs(gltf, tgeom, prim.targets[j], false);\r\n\r\n                    // { // calculate normals for final position of morphtarget for later...\r\n                    //     for (let i = 0; i < tgeom.vertices.length; i++) tgeom.vertices[i] += this.geom.vertices[i];\r\n                    //     tgeom.calculateNormals();\r\n                    //     for (let i = 0; i < tgeom.vertices.length; i++) tgeom.vertices[i] -= this.geom.vertices[i];\r\n                    // }\r\n\r\n                    this.geom.morphTargets.push(tgeom);\r\n                }\r\n            }\r\n            if (finished)finished(this);\r\n        }\r\n    }\r\n\r\n    _linearToSrgb(x)\r\n    {\r\n        if (x <= 0)\r\n            return 0;\r\n        else if (x >= 1)\r\n            return 1;\r\n        else if (x < 0.0031308)\r\n            return x * 12.92;\r\n        else\r\n            return x ** (1 / 2.2) * 1.055 - 0.055;\r\n    }\r\n\r\n    calcVertexColors(arr, type)\r\n    {\r\n        let vertexColors = null;\r\n        if (arr instanceof Float32Array)\r\n        {\r\n            let div = false;\r\n            for (let i = 0; i < arr.length; i++)\r\n            {\r\n                if (arr[i] > 1)\r\n                {\r\n                    div = true;\r\n                    continue;\r\n                }\r\n            }\r\n\r\n            if (div)\r\n                for (let i = 0; i < arr.length; i++) arr[i] /= 65535;\r\n\r\n            vertexColors = arr;\r\n        }\r\n\r\n        else if (arr instanceof Uint16Array)\r\n        {\r\n            const fb = new Float32Array(arr.length);\r\n            for (let i = 0; i < arr.length; i++) fb[i] = arr[i] / 65535;\r\n\r\n            vertexColors = fb;\r\n        }\r\n        else vertexColors = arr;\r\n\r\n        for (let i = 0; i < vertexColors.length; i++)\r\n        {\r\n            vertexColors[i] = this._linearToSrgb(vertexColors[i]);\r\n        }\r\n\r\n        if (arr.cblStride == 3)\r\n        {\r\n            const nc = new Float32Array(vertexColors.length / 3 * 4);\r\n            for (let i = 0; i < vertexColors.length / 3; i++)\r\n            {\r\n                nc[i * 4 + 0] = vertexColors[i * 3 + 0];\r\n                nc[i * 4 + 1] = vertexColors[i * 3 + 1];\r\n                nc[i * 4 + 2] = vertexColors[i * 3 + 2];\r\n                nc[i * 4 + 3] = 1;\r\n            }\r\n            vertexColors = nc;\r\n        }\r\n\r\n        return vertexColors;\r\n    }\r\n\r\n    fillGeomAttribs(gltf, tgeom, attribs, setGeom)\r\n    {\r\n        if (attribs.hasOwnProperty(\"POSITION\")) tgeom.vertices = gltf.accBuffers[attribs.POSITION];\r\n        if (attribs.hasOwnProperty(\"NORMAL\")) tgeom.vertexNormals = gltf.accBuffers[attribs.NORMAL];\r\n        if (attribs.hasOwnProperty(\"TANGENT\")) tgeom.tangents = gltf.accBuffers[attribs.TANGENT];\r\n\r\n        // // console.log(gltf.accBuffers[attribs.COLOR_0])\r\n        // console.log(gltf);\r\n\r\n        if (attribs.hasOwnProperty(\"COLOR_0\")) tgeom.vertexColors = this.calcVertexColors(gltf.accBuffers[attribs.COLOR_0], gltf.accBuffers[attribs.COLOR_0].type);\r\n        if (attribs.hasOwnProperty(\"COLOR_1\")) tgeom.setAttribute(\"attrVertColor1\", this.calcVertexColors(gltf.accBuffers[attribs.COLOR_1]), gltf.accBuffers[attribs.COLOR_1].type);\r\n        if (attribs.hasOwnProperty(\"COLOR_2\")) tgeom.setAttribute(\"attrVertColor2\", this.calcVertexColors(gltf.accBuffers[attribs.COLOR_2]), gltf.accBuffers[attribs.COLOR_2].type);\r\n        if (attribs.hasOwnProperty(\"COLOR_3\")) tgeom.setAttribute(\"attrVertColor3\", this.calcVertexColors(gltf.accBuffers[attribs.COLOR_3]), gltf.accBuffers[attribs.COLOR_3].type);\r\n        if (attribs.hasOwnProperty(\"COLOR_4\")) tgeom.setAttribute(\"attrVertColor4\", this.calcVertexColors(gltf.accBuffers[attribs.COLOR_4]), gltf.accBuffers[attribs.COLOR_4].type);\r\n\r\n        if (attribs.hasOwnProperty(\"TEXCOORD_0\")) tgeom.texCoords = gltf.accBuffers[attribs.TEXCOORD_0];\r\n        if (attribs.hasOwnProperty(\"TEXCOORD_1\")) tgeom.setAttribute(\"attrTexCoord1\", gltf.accBuffers[attribs.TEXCOORD_1], 2);\r\n        if (attribs.hasOwnProperty(\"TEXCOORD_2\")) tgeom.setAttribute(\"attrTexCoord2\", gltf.accBuffers[attribs.TEXCOORD_2], 2);\r\n        if (attribs.hasOwnProperty(\"TEXCOORD_3\")) tgeom.setAttribute(\"attrTexCoord3\", gltf.accBuffers[attribs.TEXCOORD_3], 2);\r\n        if (attribs.hasOwnProperty(\"TEXCOORD_4\")) tgeom.setAttribute(\"attrTexCoord4\", gltf.accBuffers[attribs.TEXCOORD_4], 2);\r\n\r\n        if (attribs.hasOwnProperty(\"WEIGHTS_0\"))\r\n        {\r\n            tgeom.setAttribute(\"attrWeights\", gltf.accBuffers[attribs.WEIGHTS_0], 4);\r\n        }\r\n        if (attribs.hasOwnProperty(\"JOINTS_0\"))\r\n        {\r\n            if (!gltf.accBuffers[attribs.JOINTS_0])console.log(\"no !gltf.accBuffers[attribs.JOINTS_0]\");\r\n            tgeom.setAttribute(\"attrJoints\", gltf.accBuffers[attribs.JOINTS_0], 4);\r\n        }\r\n\r\n        if (attribs.hasOwnProperty(\"POSITION\")) gltf.accBuffersDelete.push(attribs.POSITION);\r\n        if (attribs.hasOwnProperty(\"NORMAL\")) gltf.accBuffersDelete.push(attribs.NORMAL);\r\n        if (attribs.hasOwnProperty(\"TEXCOORD_0\")) gltf.accBuffersDelete.push(attribs.TEXCOORD_0);\r\n        if (attribs.hasOwnProperty(\"TANGENT\")) gltf.accBuffersDelete.push(attribs.TANGENT);\r\n        if (attribs.hasOwnProperty(\"COLOR_0\"))gltf.accBuffersDelete.push(attribs.COLOR_0);\r\n        if (attribs.hasOwnProperty(\"COLOR_0\"))gltf.accBuffersDelete.push(attribs.COLOR_0);\r\n        if (attribs.hasOwnProperty(\"COLOR_1\"))gltf.accBuffersDelete.push(attribs.COLOR_1);\r\n        if (attribs.hasOwnProperty(\"COLOR_2\"))gltf.accBuffersDelete.push(attribs.COLOR_2);\r\n        if (attribs.hasOwnProperty(\"COLOR_3\"))gltf.accBuffersDelete.push(attribs.COLOR_3);\r\n\r\n        if (attribs.hasOwnProperty(\"TEXCOORD_1\")) gltf.accBuffersDelete.push(attribs.TEXCOORD_1);\r\n        if (attribs.hasOwnProperty(\"TEXCOORD_2\")) gltf.accBuffersDelete.push(attribs.TEXCOORD_2);\r\n        if (attribs.hasOwnProperty(\"TEXCOORD_3\")) gltf.accBuffersDelete.push(attribs.TEXCOORD_3);\r\n        if (attribs.hasOwnProperty(\"TEXCOORD_4\")) gltf.accBuffersDelete.push(attribs.TEXCOORD_4);\r\n\r\n        if (setGeom !== false) if (tgeom && tgeom.verticesIndices) this.setGeom(tgeom);\r\n    }\r\n\r\n    setGeom(geom)\r\n    {\r\n        if (inNormFormat.get() == \"X-ZY\")\r\n        {\r\n            for (let i = 0; i < geom.vertexNormals.length; i += 3)\r\n            {\r\n                let t = geom.vertexNormals[i + 2];\r\n                geom.vertexNormals[i + 2] = geom.vertexNormals[i + 1];\r\n                geom.vertexNormals[i + 1] = -t;\r\n            }\r\n        }\r\n\r\n        if (inVertFormat.get() == \"XZ-Y\")\r\n        {\r\n            for (let i = 0; i < geom.vertices.length; i += 3)\r\n            {\r\n                let t = geom.vertices[i + 2];\r\n                geom.vertices[i + 2] = -geom.vertices[i + 1];\r\n                geom.vertices[i + 1] = t;\r\n            }\r\n        }\r\n\r\n        if (this.primitive == this.TRIANGLES)\r\n        {\r\n            if (inCalcNormals.get() == \"Force Smooth\" || inCalcNormals.get() == false) geom.calculateNormals();\r\n            else if (!geom.vertexNormals.length && inCalcNormals.get() == \"Auto\") geom.calculateNormals({ \"smooth\": false });\r\n\r\n            if ((!geom.biTangents || geom.biTangents.length == 0) && geom.tangents)\r\n            {\r\n                const bitan = vec3.create();\r\n                const tan = vec3.create();\r\n\r\n                const tangents = geom.tangents;\r\n                geom.tangents = new Float32Array(tangents.length / 4 * 3);\r\n                geom.biTangents = new Float32Array(tangents.length / 4 * 3);\r\n\r\n                for (let i = 0; i < tangents.length; i += 4)\r\n                {\r\n                    const idx = i / 4 * 3;\r\n\r\n                    vec3.cross(\r\n                        bitan,\r\n                        [geom.vertexNormals[idx], geom.vertexNormals[idx + 1], geom.vertexNormals[idx + 2]],\r\n                        [tangents[i], tangents[i + 1], tangents[i + 2]]\r\n                    );\r\n\r\n                    vec3.div(bitan, bitan, [tangents[i + 3], tangents[i + 3], tangents[i + 3]]);\r\n                    vec3.normalize(bitan, bitan);\r\n\r\n                    geom.biTangents[idx + 0] = bitan[0];\r\n                    geom.biTangents[idx + 1] = bitan[1];\r\n                    geom.biTangents[idx + 2] = bitan[2];\r\n\r\n                    geom.tangents[idx + 0] = tangents[i + 0];\r\n                    geom.tangents[idx + 1] = tangents[i + 1];\r\n                    geom.tangents[idx + 2] = tangents[i + 2];\r\n                }\r\n            }\r\n\r\n            if (geom.tangents.length === 0 || inCalcNormals.get() != \"Never\")\r\n            {\r\n                // console.log(\"[gltf ]no tangents... calculating tangents...\");\r\n                geom.calcTangentsBitangents();\r\n            }\r\n        }\r\n\r\n        this.geom = geom;\r\n\r\n        this.bounds = geom.getBounds();\r\n    }\r\n\r\n    render(cgl, ignoreMaterial, skinRenderer)\r\n    {\r\n        if (!this.mesh && this.geom && this.geom.verticesIndices)\r\n        {\r\n            let g = this.geom;\r\n            if (this.geom.vertices.length / 3 > 64000 && this.geom.verticesIndices.length > 0)\r\n            {\r\n                g = this.geom.copy();\r\n                g.unIndex(false, true);\r\n            }\r\n\r\n            let glprim;\r\n\r\n            if (cgl.gl)\r\n            {\r\n                if (this.primitive == this.TRIANGLES)glprim = cgl.gl.TRIANGLES;\r\n                else if (this.primitive == this.LINES)glprim = cgl.gl.LINES;\r\n                else if (this.primitive == this.LINE_STRIP)glprim = cgl.gl.LINE_STRIP;\r\n                else if (this.primitive == this.POINTS)glprim = cgl.gl.POINTS;\r\n                else\r\n                {\r\n                    op.logWarn(\"unknown primitive type\", this);\r\n                }\r\n            }\r\n\r\n            this.mesh = op.patch.cg.createMesh(g, { \"glPrimitive\": glprim });\r\n        }\r\n\r\n        if (this.mesh)\r\n        {\r\n            // update morphTargets\r\n            if (this.geom && this.geom.morphTargets.length && !this.morphTargetsRenderMod)\r\n            {\r\n                this.mesh.addVertexNumbers = true;\r\n                this.morphTargetsRenderMod = new GltfTargetsRenderer(this);\r\n            }\r\n\r\n            let useMat = !ignoreMaterial && this.material != -1 && gltf.shaders[this.material];\r\n            if (skinRenderer)useMat = false;\r\n\r\n            if (useMat) cgl.pushShader(gltf.shaders[this.material]);\r\n\r\n            const currentShader = cgl.getShader() || {};\r\n            const uniDiff = currentShader.uniformColorDiffuse;\r\n\r\n            const uniPbrMetalness = currentShader.uniformPbrMetalness;\r\n            const uniPbrRoughness = currentShader.uniformPbrRoughness;\r\n\r\n            // if (gltf.shaders[this.material] && !inUseMatProps.get())\r\n            // {\r\n            //     gltf.shaders[this.material]=null;\r\n            // }\r\n\r\n            if (!gltf.shaders[this.material] && inUseMatProps.get())\r\n            {\r\n                if (uniDiff && this._matDiffuseColor)\r\n                {\r\n                    this._matDiffuseColorOrig = [uniDiff.getValue()[0], uniDiff.getValue()[1], uniDiff.getValue()[2], uniDiff.getValue()[3]];\r\n                    uniDiff.setValue(this._matDiffuseColor);\r\n                }\r\n\r\n                if (uniPbrMetalness)\r\n                    if (this._matPbrMetalness != null)\r\n                    {\r\n                        this._matPbrMetalnessOrig = uniPbrMetalness.getValue();\r\n                        uniPbrMetalness.setValue(this._matPbrMetalness);\r\n                    }\r\n                    else\r\n                        uniPbrMetalness.setValue(0);\r\n\r\n                if (uniPbrRoughness)\r\n                    if (this._matPbrRoughness != null)\r\n                    {\r\n                        this._matPbrRoughnessOrig = uniPbrRoughness.getValue();\r\n                        uniPbrRoughness.setValue(this._matPbrRoughness);\r\n                    }\r\n                    else\r\n                    {\r\n                        uniPbrRoughness.setValue(0);\r\n                    }\r\n            }\r\n\r\n            if (this.morphTargetsRenderMod) this.morphTargetsRenderMod.renderStart(cgl, 0);\r\n            if (this.mesh)\r\n            {\r\n                this.mesh.render(cgl.getShader(), ignoreMaterial);\r\n            }\r\n            if (this.morphTargetsRenderMod) this.morphTargetsRenderMod.renderFinish(cgl);\r\n\r\n            if (inUseMatProps.get())\r\n            {\r\n                if (uniDiff && this._matDiffuseColor) uniDiff.setValue(this._matDiffuseColorOrig);\r\n                if (uniPbrMetalness && this._matPbrMetalnessOrig != undefined) uniPbrMetalness.setValue(this._matPbrMetalnessOrig);\r\n                if (uniPbrRoughness && this._matPbrRoughnessOrig != undefined) uniPbrRoughness.setValue(this._matPbrRoughnessOrig);\r\n            }\r\n\r\n            if (useMat) cgl.popShader();\r\n        }\r\n        else\r\n        {\r\n            console.log(\"no mesh......\");\r\n        }\r\n    }\r\n};\r\n","inc_meshGroup_js":"const gltfMeshGroup = class\r\n{\r\n    constructor(gltf, m)\r\n    {\r\n        this.bounds = new CABLES.CG.BoundingBox();\r\n        this.meshes = [];\r\n\r\n        m.name = m.name || (\"unknown mesh \" + CABLES.simpleId());\r\n\r\n        this.name = m.name;\r\n        const prims = m.primitives;\r\n\r\n        for (let i = 0; i < prims.length; i++)\r\n        {\r\n            const mesh = new gltfMesh(this.name, prims[i], gltf,\r\n                (mesh) =>\r\n                {\r\n                    mesh.extras = m.extras;\r\n                    this.bounds.apply(mesh.bounds);\r\n                });\r\n\r\n            mesh.submeshIndex = i;\r\n            this.meshes.push(mesh);\r\n        }\r\n    }\r\n\r\n    render(cgl, ignoreMat, skinRenderer, _time, weights)\r\n    {\r\n        for (let i = 0; i < this.meshes.length; i++)\r\n        {\r\n            const useMat = gltf.shaders[this.meshes[i].material];\r\n\r\n            if (!ignoreMat && useMat) cgl.pushShader(gltf.shaders[this.meshes[i].material]);\r\n            if (skinRenderer)skinRenderer.renderStart(cgl, _time);\r\n            if (weights) this.meshes[i].weights = weights;\r\n            this.meshes[i].render(cgl, ignoreMat, skinRenderer, _time);\r\n            if (skinRenderer)skinRenderer.renderFinish(cgl);\r\n            if (!ignoreMat && useMat) cgl.popShader();\r\n        }\r\n    }\r\n};\r\n","inc_node_js":"const gltfNode = class\r\n{\r\n    constructor(node, gltf)\r\n    {\r\n        this.isChild = node.isChild || false;\r\n        node.name = node.name || \"unknown node \" + CABLES.simpleId();\r\n        this.name = node.name;\r\n        if (node.hasOwnProperty(\"camera\")) this.camera = node.camera;\r\n        this.hidden = false;\r\n        this.mat = mat4.create();\r\n        this._animActions = {};\r\n        this.animWeights = [];\r\n        this._animMat = mat4.create();\r\n        this._tempMat = mat4.create();\r\n        this._tempQuat = quat.create();\r\n        this._tempRotmat = mat4.create();\r\n        this.mesh = null;\r\n        this.children = [];\r\n        this._node = node;\r\n        this._gltf = gltf;\r\n        this.absMat = mat4.create();\r\n        this.addTranslate = null;\r\n        this._tempAnimScale = null;\r\n        this.addMulMat = null;\r\n        this.updateMatrix();\r\n        this.skinRenderer = null;\r\n        this.copies = [];\r\n    }\r\n\r\n    get skin()\r\n    {\r\n        if (this._node.hasOwnProperty(\"skin\")) return this._node.skin;\r\n        else return -1;\r\n    }\r\n\r\n    copy()\r\n    {\r\n        this.isCopy = true;\r\n        const n = new gltfNode(this._node, this._gltf);\r\n        n.copyOf = this;\r\n\r\n        n._animActions = this._animActions;\r\n        n.children = this.children;\r\n        if (this.skin) n.skinRenderer = new GltfSkin(this);\r\n\r\n        this.updateMatrix();\r\n        return n;\r\n    }\r\n\r\n    hasSkin()\r\n    {\r\n        if (this._node.hasOwnProperty(\"skin\")) return this._gltf.json.skins[this._node.skin].name || \"unknown\";\r\n        return false;\r\n    }\r\n\r\n    initSkin()\r\n    {\r\n        if (this.skin > -1)\r\n        {\r\n            this.skinRenderer = new GltfSkin(this);\r\n        }\r\n    }\r\n\r\n    updateMatrix()\r\n    {\r\n        mat4.identity(this.mat);\r\n        if (this._node.translation) mat4.translate(this.mat, this.mat, this._node.translation);\r\n\r\n        if (this._node.rotation)\r\n        {\r\n            const rotmat = mat4.create();\r\n            this._rot = this._node.rotation;\r\n\r\n            mat4.fromQuat(rotmat, this._node.rotation);\r\n            mat4.mul(this.mat, this.mat, rotmat);\r\n        }\r\n\r\n        if (this._node.scale)\r\n        {\r\n            this._scale = this._node.scale;\r\n            mat4.scale(this.mat, this.mat, this._scale);\r\n        }\r\n\r\n        if (this._node.hasOwnProperty(\"mesh\"))\r\n        {\r\n            this.mesh = this._gltf.meshes[this._node.mesh];\r\n            if (this.isCopy)\r\n            {\r\n            }\r\n        }\r\n\r\n        if (this._node.children)\r\n        {\r\n            for (let i = 0; i < this._node.children.length; i++)\r\n            {\r\n                this._gltf.json.nodes[i].isChild = true;\r\n                if (this._gltf.nodes[this._node.children[i]]) this._gltf.nodes[this._node.children[i]].isChild = true;\r\n                this.children.push(this._node.children[i]);\r\n            }\r\n        }\r\n    }\r\n\r\n    unHide()\r\n    {\r\n        this.hidden = false;\r\n        for (let i = 0; i < this.children.length; i++)\r\n            if (this.children[i].unHide) this.children[i].unHide();\r\n    }\r\n\r\n    calcBounds(gltf, mat, bounds)\r\n    {\r\n        const localMat = mat4.create();\r\n\r\n        if (mat) mat4.copy(localMat, mat);\r\n        if (this.mat) mat4.mul(localMat, localMat, this.mat);\r\n\r\n        if (this.mesh)\r\n        {\r\n            const bb = this.mesh.bounds.copy();\r\n            bb.mulMat4(localMat);\r\n            bounds.apply(bb);\r\n\r\n            if (bounds.changed)\r\n            {\r\n                boundingPoints.push(\r\n                    bb._min[0] || 0, bb._min[1] || 0, bb._min[2] || 0,\r\n                    bb._max[0] || 0, bb._max[1] || 0, bb._max[2] || 0);\r\n            }\r\n        }\r\n\r\n        for (let i = 0; i < this.children.length; i++)\r\n        {\r\n            if (gltf.nodes[this.children[i]] && gltf.nodes[this.children[i]].calcBounds)\r\n            {\r\n                const b = gltf.nodes[this.children[i]].calcBounds(gltf, localMat, bounds);\r\n\r\n                bounds.apply(b);\r\n            }\r\n        }\r\n\r\n        if (bounds.changed) return bounds;\r\n        else return null;\r\n    }\r\n\r\n    setAnimAction(name)\r\n    {\r\n        if (!name) return;\r\n\r\n        this._currentAnimaction = name;\r\n\r\n        if (name && !this._animActions[name]) return null;\r\n\r\n        for (let path in this._animActions[name])\r\n        {\r\n            if (path == \"translation\") this._animTrans = this._animActions[name][path];\r\n            else if (path == \"rotation\") this._animRot = this._animActions[name][path];\r\n            else if (path == \"scale\") this._animScale = this._animActions[name][path];\r\n            else if (path == \"weights\") this.animWeights = this._animActions[name][path];\r\n        }\r\n    }\r\n\r\n    setAnim(path, name, anims)\r\n    {\r\n        if (!path || !name || !anims) return;\r\n\r\n        this._animActions[name] = this._animActions[name] || {};\r\n\r\n        // debugger;\r\n\r\n        // for (let i = 0; i < this.copies.length; i++) this.copies[i]._animActions = this._animActions;\r\n\r\n        if (this._animActions[name][path]) op.log(\"[gltfNode] animation action path already exists\", name, path, this._animActions[name][path]);\r\n\r\n        this._animActions[name][path] = anims;\r\n\r\n        if (path == \"translation\") this._animTrans = anims;\r\n        else if (path == \"rotation\") this._animRot = anims;\r\n        else if (path == \"scale\") this._animScale = anims;\r\n        else if (path == \"weights\") this.animWeights = this._animActions[name][path];\r\n    }\r\n\r\n    modelMatLocal()\r\n    {\r\n        return this._animMat || this.mat;\r\n    }\r\n\r\n    modelMatAbs()\r\n    {\r\n        return this.absMat;\r\n    }\r\n\r\n    transform(cgl, _time)\r\n    {\r\n        if (!_time && _time != 0)_time = time;\r\n\r\n        this._lastTimeTrans = _time;\r\n\r\n        gltfTransforms++;\r\n\r\n        if (!this._animTrans && !this._animRot && !this._animScale)\r\n        {\r\n            mat4.mul(cgl.mMatrix, cgl.mMatrix, this.mat);\r\n            this._animMat = null;\r\n        }\r\n        else\r\n        {\r\n            this._animMat = this._animMat || mat4.create();\r\n            mat4.identity(this._animMat);\r\n\r\n            const playAnims = true;\r\n\r\n            if (playAnims && this._animTrans)\r\n            {\r\n                mat4.translate(this._animMat, this._animMat, [\r\n                    this._animTrans[0].getValue(_time),\r\n                    this._animTrans[1].getValue(_time),\r\n                    this._animTrans[2].getValue(_time)]);\r\n            }\r\n            else\r\n            if (this._node.translation) mat4.translate(this._animMat, this._animMat, this._node.translation);\r\n\r\n            if (playAnims && this._animRot)\r\n            {\r\n                if (this._animRot[0].defaultEasing == CABLES.EASING_LINEAR) CABLES.Anim.slerpQuaternion(_time, this._tempQuat, this._animRot[0], this._animRot[1], this._animRot[2], this._animRot[3]);\r\n                else if (this._animRot[0].defaultEasing == CABLES.EASING_ABSOLUTE)\r\n                {\r\n                    this._tempQuat[0] = this._animRot[0].getValue(_time);\r\n                    this._tempQuat[1] = this._animRot[1].getValue(_time);\r\n                    this._tempQuat[2] = this._animRot[2].getValue(_time);\r\n                    this._tempQuat[3] = this._animRot[3].getValue(_time);\r\n                }\r\n                else if (this._animRot[0].defaultEasing == CABLES.EASING_CUBICSPLINE)\r\n                {\r\n                    CABLES.Anim.slerpQuaternion(_time, this._tempQuat, this._animRot[0], this._animRot[1], this._animRot[2], this._animRot[3]);\r\n                }\r\n\r\n                mat4.fromQuat(this._tempMat, this._tempQuat);\r\n                mat4.mul(this._animMat, this._animMat, this._tempMat);\r\n            }\r\n            else if (this._rot)\r\n            {\r\n                mat4.fromQuat(this._tempRotmat, this._rot);\r\n                mat4.mul(this._animMat, this._animMat, this._tempRotmat);\r\n            }\r\n\r\n            if (playAnims && this._animScale)\r\n            {\r\n                if (!this._tempAnimScale) this._tempAnimScale = [1, 1, 1];\r\n                this._tempAnimScale[0] = this._animScale[0].getValue(_time);\r\n                this._tempAnimScale[1] = this._animScale[1].getValue(_time);\r\n                this._tempAnimScale[2] = this._animScale[2].getValue(_time);\r\n                mat4.scale(this._animMat, this._animMat, this._tempAnimScale);\r\n            }\r\n            else if (this._scale) mat4.scale(this._animMat, this._animMat, this._scale);\r\n\r\n            mat4.mul(cgl.mMatrix, cgl.mMatrix, this._animMat);\r\n        }\r\n\r\n        if (this.animWeights)\r\n        {\r\n            this.weights = this.weights || [];\r\n\r\n            let str = \"\";\r\n            for (let i = 0; i < this.animWeights.length; i++)\r\n            {\r\n                this.weights[i] = this.animWeights[i].getValue(_time);\r\n                str += this.weights[i] + \"/\";\r\n            }\r\n\r\n            // this.mesh.weights=this.animWeights.get(_time);\r\n        }\r\n\r\n        if (this.addTranslate) mat4.translate(cgl.mMatrix, cgl.mMatrix, this.addTranslate);\r\n\r\n        if (this.addMulMat) mat4.mul(cgl.mMatrix, cgl.mMatrix, this.addMulMat);\r\n\r\n        mat4.copy(this.absMat, cgl.mMatrix);\r\n    }\r\n\r\n    render(cgl, dontTransform, dontDrawMesh, ignoreMaterial, ignoreChilds, drawHidden, _time)\r\n    {\r\n        if (!dontTransform) cgl.pushModelMatrix();\r\n\r\n        if (_time === undefined) _time = gltf.time;\r\n\r\n        if (!dontTransform || this.skinRenderer) this.transform(cgl, _time);\r\n\r\n        if (this.hidden && !drawHidden)\r\n        {\r\n        }\r\n        else\r\n        {\r\n            if (this.skinRenderer)\r\n            {\r\n                this.skinRenderer.time = _time;\r\n                if (!dontDrawMesh)\r\n                    this.mesh.render(cgl, ignoreMaterial, this.skinRenderer, _time, this.weights);\r\n            }\r\n            else\r\n            {\r\n                if (this.mesh && !dontDrawMesh)\r\n                    this.mesh.render(cgl, ignoreMaterial, null, _time, this.weights);\r\n            }\r\n        }\r\n\r\n        if (!ignoreChilds && !this.hidden)\r\n            for (let i = 0; i < this.children.length; i++)\r\n                if (gltf.nodes[this.children[i]])\r\n                    gltf.nodes[this.children[i]].render(cgl, dontTransform, dontDrawMesh, ignoreMaterial, ignoreChilds, drawHidden, _time);\r\n\r\n        if (!dontTransform)cgl.popModelMatrix();\r\n    }\r\n};\r\n","inc_print_js":"let tab = null;\r\n\r\nfunction closeTab()\r\n{\r\n    if (tab)gui.mainTabs.closeTab(tab.id);\r\n    tab = null;\r\n}\r\n\r\nfunction formatVec(arr)\r\n{\r\n    const nums = [];\r\n    for (let i = 0; i < arr.length; i++)\r\n    {\r\n        nums.push(Math.round(arr[i] * 1000) / 1000);\r\n    }\r\n\r\n    return nums.join(\",\");\r\n}\r\n\r\nfunction printNode(html, node, level)\r\n{\r\n    if (!gltf) return;\r\n\r\n    html += \"<tr class=\\\"row\\\">\";\r\n\r\n    let ident = \"\";\r\n    let identSpace = \"\";\r\n\r\n    for (let i = 1; i < level; i++)\r\n    {\r\n        identSpace += \"&nbsp;&nbsp;&nbsp;\";\r\n        let identClass = \"identBg\";\r\n        if (i == 1)identClass = \"identBgLevel0\";\r\n        ident += \"<td class=\\\"ident \" + identClass + \"\\\" ><div style=\\\"\\\"></div></td>\";\r\n    }\r\n    let id = CABLES.uuid();\r\n    html += ident;\r\n    html += \"<td colspan=\\\"\" + (21 - level) + \"\\\">\";\r\n\r\n    if (node.mesh && node.mesh.meshes.length)html += \"<span class=\\\"icon icon-cube\\\"></span>&nbsp;\";\r\n    else html += \"<span class=\\\"icon icon-box-select\\\"></span> &nbsp;\";\r\n\r\n    html += node.name + \"</td><td></td>\";\r\n\r\n    if (node.mesh)\r\n    {\r\n        html += \"<td>\";\r\n        for (let i = 0; i < node.mesh.meshes.length; i++)\r\n        {\r\n            if (i > 0)html += \", \";\r\n            html += node.mesh.meshes[i].name;\r\n        }\r\n\r\n        html += \"</td>\";\r\n\r\n        html += \"<td>\";\r\n        html += node.hasSkin() || \"-\";\r\n        html += \"</td>\";\r\n\r\n        html += \"<td>\";\r\n        let countMats = 0;\r\n        for (let i = 0; i < node.mesh.meshes.length; i++)\r\n        {\r\n            if (countMats > 0)html += \", \";\r\n            if (gltf.json.materials && node.mesh.meshes[i].hasOwnProperty(\"material\"))\r\n            {\r\n                if (gltf.json.materials[node.mesh.meshes[i].material])\r\n                {\r\n                    html += gltf.json.materials[node.mesh.meshes[i].material].name;\r\n                    countMats++;\r\n                }\r\n            }\r\n        }\r\n        if (countMats == 0)html += \"none\";\r\n        html += \"</td>\";\r\n    }\r\n    else\r\n    {\r\n        html += \"<td>-</td><td>-</td><td>-</td>\";\r\n    }\r\n\r\n    html += \"<td>\";\r\n\r\n    if (node._node.translation || node._node.rotation || node._node.scale)\r\n    {\r\n        let info = \"\";\r\n\r\n        if (node._node.translation)info += \"Translate: `\" + formatVec(node._node.translation) + \"` || \";\r\n        if (node._node.rotation)info += \"Rotation: `\" + formatVec(node._node.rotation) + \"` || \";\r\n        if (node._node.scale)info += \"Scale: `\" + formatVec(node._node.scale) + \"` || \";\r\n\r\n        html += \"<span class=\\\"icon icon-gizmo info\\\" data-info=\\\"\" + info + \"\\\"></span> &nbsp;\";\r\n    }\r\n\r\n    if (node._animRot || node._animScale || node._animTrans)\r\n    {\r\n        let info = \"Animated: \";\r\n        if (node._animRot) info += \"Rot \";\r\n        if (node._animScale) info += \"Scale \";\r\n        if (node._animTrans) info += \"Trans \";\r\n\r\n        html += \"<span class=\\\"icon icon-clock info\\\" data-info=\\\"\" + info + \"\\\"></span>&nbsp;\";\r\n    }\r\n\r\n    if (!node._node.translation && !node._node.rotation && !node._node.scale && !node._animRot && !node._animScale && !node._animTrans) html += \"-\";\r\n\r\n    html += \"</td>\";\r\n\r\n    html += \"<td>\";\r\n    let hideclass = \"\";\r\n    if (node.hidden)hideclass = \"node-hidden\";\r\n\r\n    // html+='';\r\n    html += \"<a onclick=\\\"gui.corePatch().getOpById('\" + op.id + \"').exposeNode('\" + node.name + \"','transform')\\\" class=\\\"treebutton\\\">Transform</a>\";\r\n    html += \" <a onclick=\\\"gui.corePatch().getOpById('\" + op.id + \"').exposeNode('\" + node.name + \"','hierarchy')\\\" class=\\\"treebutton\\\">Hierarchy</a>\";\r\n    html += \" <a onclick=\\\"gui.corePatch().getOpById('\" + op.id + \"').exposeNode('\" + node.name + \"')\\\" class=\\\"treebutton\\\">Node</a>\";\r\n\r\n    if (node.hasSkin())\r\n        html += \" <a onclick=\\\"gui.corePatch().getOpById('\" + op.id + \"').exposeNode('\" + node.name + \"',false,{skin:true});\\\" class=\\\"treebutton\\\">Skin</a>\";\r\n\r\n    html += \"</td><td>\";\r\n    html += \"&nbsp;<span class=\\\"icon iconhover icon-eye \" + hideclass + \"\\\" onclick=\\\"gui.corePatch().getOpById('\" + op.id + \"').toggleNodeVisibility('\" + node.name + \"');this.classList.toggle('node-hidden');\\\"></span>\";\r\n    html += \"</td>\";\r\n\r\n    html += \"</tr>\";\r\n\r\n    if (node.children)\r\n    {\r\n        for (let i = 0; i < node.children.length; i++)\r\n            html = printNode(html, gltf.nodes[node.children[i]], level + 1);\r\n    }\r\n\r\n    return html;\r\n}\r\n\r\nfunction printMaterial(mat, idx)\r\n{\r\n    let html = \"<tr>\";\r\n    html += \" <td>\" + idx + \"</td>\";\r\n    html += \" <td>\" + mat.name + \"</td>\";\r\n\r\n    html += \" <td>\";\r\n\r\n    const info = JSON.stringify(mat, null, 4).replaceAll(\"\\\"\", \"\").replaceAll(\"\\n\", \"<br/>\");\r\n\r\n    html += \"<span class=\\\"icon icon-info\\\" onclick=\\\"new CABLES.UI.ModalDialog({ 'html': '<pre>\" + info + \"</pre>', 'title': '\" + mat.name + \"' });\\\"></span>&nbsp;\";\r\n\r\n    if (mat.pbrMetallicRoughness && mat.pbrMetallicRoughness.baseColorFactor)\r\n    {\r\n        let rgb = \"\";\r\n        rgb += \"\" + Math.round(mat.pbrMetallicRoughness.baseColorFactor[0] * 255);\r\n        rgb += \",\" + Math.round(mat.pbrMetallicRoughness.baseColorFactor[1] * 255);\r\n        rgb += \",\" + Math.round(mat.pbrMetallicRoughness.baseColorFactor[2] * 255);\r\n\r\n        html += \"<div style=\\\"width:15px;height:15px;background-color:rgb(\" + rgb + \");display:inline-block\\\">&nbsp;</a>\";\r\n    }\r\n    html += \" <td style=\\\"\\\">\" + (gltf.shaders[idx] ? \"-\" : \"<a onclick=\\\"gui.corePatch().getOpById('\" + op.id + \"').assignMaterial('\" + mat.name + \"')\\\" class=\\\"treebutton\\\">Assign</a>\") + \"<td>\";\r\n    html += \"<td>\";\r\n\r\n    html += \"</tr>\";\r\n    return html;\r\n}\r\n\r\nfunction printInfo()\r\n{\r\n    if (!gltf) return;\r\n\r\n    const startTime = performance.now();\r\n    const sizes = {};\r\n    let html = \"<div style=\\\"overflow:scroll;width:100%;height:100%\\\">\";\r\n\r\n    html += \"File: <a href=\\\"\" + CABLES.platform.getCablesUrl() + \"/asset/patches/?filename=\" + inFile.get() + \"\\\" target=\\\"_blank\\\">\" + CABLES.basename(inFile.get()) + \"</a><br/>\";\r\n\r\n    html += \"Generator:\" + gltf.json.asset.generator;\r\n\r\n    let numNodes = 0;\r\n    if (gltf.json.nodes)numNodes = gltf.json.nodes.length;\r\n    html += \"<div id=\\\"groupNodes\\\">Nodes (\" + numNodes + \")</div>\";\r\n\r\n    html += \"<table id=\\\"sectionNodes\\\" class=\\\"table treetable\\\">\";\r\n\r\n    html += \"<tr>\";\r\n    html += \" <th colspan=\\\"21\\\">Name</th>\";\r\n    html += \" <th>Mesh</th>\";\r\n    html += \" <th>Skin</th>\";\r\n    html += \" <th>Material</th>\";\r\n    html += \" <th>Transform</th>\";\r\n    html += \" <th>Expose</th>\";\r\n    html += \" <th></th>\";\r\n    html += \"</tr>\";\r\n\r\n    for (let i = 0; i < gltf.nodes.length; i++)\r\n    {\r\n        if (!gltf.nodes[i].isChild)\r\n            html = printNode(html, gltf.nodes[i], 1);\r\n    }\r\n    html += \"</table>\";\r\n\r\n    // / //////////////////\r\n\r\n    let numMaterials = 0;\r\n    if (gltf.json.materials)numMaterials = gltf.json.materials.length;\r\n    html += \"<div id=\\\"groupMaterials\\\">Materials (\" + numMaterials + \")</div>\";\r\n\r\n    if (!gltf.json.materials || gltf.json.materials.length == 0)\r\n    {\r\n    }\r\n    else\r\n    {\r\n        html += \"<table id=\\\"materialtable\\\"  class=\\\"table treetable\\\">\";\r\n        html += \"<tr>\";\r\n        html += \" <th>Index</th>\";\r\n        html += \" <th>Name</th>\";\r\n        html += \" <th>Color</th>\";\r\n        html += \" <th>Function</th>\";\r\n        html += \" <th></th>\";\r\n        html += \"</tr>\";\r\n        for (let i = 0; i < gltf.json.materials.length; i++)\r\n        {\r\n            html += printMaterial(gltf.json.materials[i], i);\r\n        }\r\n        html += \"</table>\";\r\n    }\r\n\r\n    // / ///////////////////////\r\n\r\n    html += \"<div id=\\\"groupMeshes\\\">Meshes (\" + gltf.json.meshes.length + \")</div>\";\r\n\r\n    html += \"<table id=\\\"meshestable\\\"  class=\\\"table treetable\\\">\";\r\n    html += \"<tr>\";\r\n    html += \" <th>Name</th>\";\r\n    html += \" <th>Node</th>\";\r\n    html += \" <th>Material</th>\";\r\n    html += \" <th>Vertices</th>\";\r\n    html += \" <th>Attributes</th>\";\r\n    html += \"</tr>\";\r\n\r\n    let sizeBufferViews = [];\r\n    sizes.meshes = 0;\r\n    sizes.meshTargets = 0;\r\n\r\n    for (let i = 0; i < gltf.json.meshes.length; i++)\r\n    {\r\n        html += \"<tr>\";\r\n        html += \"<td>\" + gltf.json.meshes[i].name + \"</td>\";\r\n\r\n        html += \"<td>\";\r\n        let count = 0;\r\n        let nodename = \"\";\r\n        if (gltf.json.nodes)\r\n            for (let j = 0; j < gltf.json.nodes.length; j++)\r\n            {\r\n                if (gltf.json.nodes[j].mesh == i)\r\n                {\r\n                    count++;\r\n                    if (count == 1)\r\n                    {\r\n                        nodename = gltf.json.nodes[j].name;\r\n                    }\r\n                }\r\n            }\r\n        if (count > 1) html += (count) + \" nodes (\" + nodename + \" ...)\";\r\n        else html += nodename;\r\n        html += \"</td>\";\r\n\r\n        // -------\r\n\r\n        html += \"<td>\";\r\n        for (let j = 0; j < gltf.json.meshes[i].primitives.length; j++)\r\n        {\r\n            if (gltf.json.meshes[i].primitives[j].hasOwnProperty(\"material\"))\r\n            {\r\n                if (gltf.json.materials[gltf.json.meshes[i]])\r\n                {\r\n                    html += gltf.json.materials[gltf.json.meshes[i].primitives[j].material].name + \" \";\r\n                }\r\n            }\r\n            else html += \"None\";\r\n        }\r\n        html += \"</td>\";\r\n\r\n        html += \"<td>\";\r\n        let numVerts = 0;\r\n        for (let j = 0; j < gltf.json.meshes[i].primitives.length; j++)\r\n        {\r\n            if (gltf.json.meshes[i].primitives[j].attributes.POSITION != undefined)\r\n            {\r\n                let v = parseInt(gltf.json.accessors[gltf.json.meshes[i].primitives[j].attributes.POSITION].count);\r\n                numVerts += v;\r\n                html += \"\" + v + \"<br/>\";\r\n            }\r\n            else html += \"-<br/>\";\r\n        }\r\n\r\n        if (gltf.json.meshes[i].primitives.length > 1)\r\n            html += \"=\" + numVerts;\r\n        html += \"</td>\";\r\n\r\n        html += \"<td>\";\r\n        for (let j = 0; j < gltf.json.meshes[i].primitives.length; j++)\r\n        {\r\n            html += Object.keys(gltf.json.meshes[i].primitives[j].attributes);\r\n            html += \" <a onclick=\\\"gui.corePatch().getOpById('\" + op.id + \"').exposeGeom('\" + gltf.json.meshes[i].name + \"',\" + j + \")\\\" class=\\\"treebutton\\\">Geometry</a>\";\r\n            html += \"<br/>\";\r\n\r\n            if (gltf.json.meshes[i].primitives[j].targets)\r\n            {\r\n                html += gltf.json.meshes[i].primitives[j].targets.length + \" targets<br/>\";\r\n\r\n                if (gltf.json.meshes[i].extras && gltf.json.meshes[i].extras.targetNames)\r\n                    html += \"Targetnames:<br/>\" + gltf.json.meshes[i].extras.targetNames.join(\"<br/>\");\r\n\r\n                html += \"<br/>\";\r\n            }\r\n        }\r\n\r\n        html += \"</td>\";\r\n        html += \"</tr>\";\r\n\r\n        for (let j = 0; j < gltf.json.meshes[i].primitives.length; j++)\r\n        {\r\n            const accessor = gltf.json.accessors[gltf.json.meshes[i].primitives[j].indices];\r\n            if (accessor)\r\n            {\r\n                let bufView = accessor.bufferView;\r\n\r\n                if (sizeBufferViews.indexOf(bufView) == -1)\r\n                {\r\n                    sizeBufferViews.push(bufView);\r\n                    if (gltf.json.bufferViews[bufView])sizes.meshes += gltf.json.bufferViews[bufView].byteLength;\r\n                }\r\n            }\r\n\r\n            for (let k in gltf.json.meshes[i].primitives[j].attributes)\r\n            {\r\n                const attr = gltf.json.meshes[i].primitives[j].attributes[k];\r\n                const bufView2 = gltf.json.accessors[attr].bufferView;\r\n\r\n                if (sizeBufferViews.indexOf(bufView2) == -1)\r\n                {\r\n                    sizeBufferViews.push(bufView2);\r\n                    if (gltf.json.bufferViews[bufView2])sizes.meshes += gltf.json.bufferViews[bufView2].byteLength;\r\n                }\r\n            }\r\n\r\n            if (gltf.json.meshes[i].primitives[j].targets)\r\n                for (let k = 0; k < gltf.json.meshes[i].primitives[j].targets.length; k++)\r\n                {\r\n                    for (let l in gltf.json.meshes[i].primitives[j].targets[k])\r\n                    {\r\n                        const accessorIdx = gltf.json.meshes[i].primitives[j].targets[k][l];\r\n                        const accessor = gltf.json.accessors[accessorIdx];\r\n                        const bufView2 = accessor.bufferView;\r\n                        console.log(\"accessor\", accessor);\r\n                        if (sizeBufferViews.indexOf(bufView2) == -1)\r\n                            if (gltf.json.bufferViews[bufView2])\r\n                            {\r\n                                sizeBufferViews.push(bufView2);\r\n                                sizes.meshTargets += gltf.json.bufferViews[bufView2].byteLength;\r\n                            }\r\n                    }\r\n                }\r\n        }\r\n    }\r\n    html += \"</table>\";\r\n\r\n    // / //////////////////////////////////\r\n\r\n    let numSamplers = 0;\r\n    let numAnims = 0;\r\n    let numKeyframes = 0;\r\n\r\n    if (gltf.json.animations)\r\n    {\r\n        numAnims = gltf.json.animations.length;\r\n        for (let i = 0; i < gltf.json.animations.length; i++)\r\n        {\r\n            numSamplers += gltf.json.animations[i].samplers.length;\r\n        }\r\n    }\r\n\r\n    html += \"<div id=\\\"groupAnims\\\">Animations (\" + numAnims + \"/\" + numSamplers + \")</div>\";\r\n\r\n    if (gltf.json.animations)\r\n    {\r\n        html += \"<table id=\\\"sectionAnim\\\" class=\\\"table treetable\\\">\";\r\n        html += \"<tr>\";\r\n        html += \"  <th>Name</th>\";\r\n        html += \"  <th>Target node</th>\";\r\n        html += \"  <th>Path</th>\";\r\n        html += \"  <th>Interpolation</th>\";\r\n        html += \"  <th>Keys</th>\";\r\n        html += \"</tr>\";\r\n\r\n\r\n        sizes.animations = 0;\r\n\r\n        for (let i = 0; i < gltf.json.animations.length; i++)\r\n        {\r\n            for (let j = 0; j < gltf.json.animations[i].samplers.length; j++)\r\n            {\r\n                let bufView = gltf.json.accessors[gltf.json.animations[i].samplers[j].input].bufferView;\r\n                if (sizeBufferViews.indexOf(bufView) == -1)\r\n                {\r\n                    sizeBufferViews.push(bufView);\r\n                    sizes.animations += gltf.json.bufferViews[bufView].byteLength;\r\n                }\r\n\r\n                bufView = gltf.json.accessors[gltf.json.animations[i].samplers[j].output].bufferView;\r\n                if (sizeBufferViews.indexOf(bufView) == -1)\r\n                {\r\n                    sizeBufferViews.push(bufView);\r\n                    sizes.animations += gltf.json.bufferViews[bufView].byteLength;\r\n                }\r\n            }\r\n\r\n            for (let j = 0; j < gltf.json.animations[i].channels.length; j++)\r\n            {\r\n                html += \"<tr>\";\r\n                html += \"  <td> Anim \" + i + \": \" + gltf.json.animations[i].name + \"</td>\";\r\n\r\n                html += \"  <td>\" + gltf.nodes[gltf.json.animations[i].channels[j].target.node].name + \"</td>\";\r\n                html += \"  <td>\";\r\n                html += gltf.json.animations[i].channels[j].target.path + \" \";\r\n                html += \"  </td>\";\r\n\r\n                const smplidx = gltf.json.animations[i].channels[j].sampler;\r\n                const smplr = gltf.json.animations[i].samplers[smplidx];\r\n\r\n                html += \"  <td>\" + smplr.interpolation + \"</td>\";\r\n\r\n                html += \"  <td>\" + gltf.json.accessors[smplr.output].count;\r\n                numKeyframes += gltf.json.accessors[smplr.output].count;\r\n\r\n                // html += \"&nbsp;&nbsp;<a onclick=\\\"gui.corePatch().getOpById('\" + op.id + \"').showAnim('\" + i + \"','\" + j + \"')\\\" class=\\\"icon icon-search\\\"></a>\";\r\n\r\n                html += \"</td>\";\r\n\r\n                html += \"</tr>\";\r\n            }\r\n        }\r\n\r\n        html += \"<tr>\";\r\n        html += \"  <td></td>\";\r\n        html += \"  <td></td>\";\r\n        html += \"  <td></td>\";\r\n        html += \"  <td></td>\";\r\n        html += \"  <td>\" + numKeyframes + \" total</td>\";\r\n        html += \"</tr>\";\r\n        html += \"</table>\";\r\n    }\r\n    else\r\n    {\r\n\r\n    }\r\n\r\n    // / ///////////////////\r\n\r\n    let numImages = 0;\r\n    if (gltf.json.images)numImages = gltf.json.images.length;\r\n    html += \"<div id=\\\"groupImages\\\">Images (\" + numImages + \")</div>\";\r\n\r\n    if (gltf.json.images)\r\n    {\r\n        html += \"<table id=\\\"sectionImages\\\" class=\\\"table treetable\\\">\";\r\n\r\n        html += \"<tr>\";\r\n        html += \"  <th>name</th>\";\r\n        html += \"  <th>type</th>\";\r\n        html += \"  <th>func</th>\";\r\n        html += \"</tr>\";\r\n\r\n        sizes.images = 0;\r\n\r\n        for (let i = 0; i < gltf.json.images.length; i++)\r\n        {\r\n            if (gltf.json.images[i].hasOwnProperty(\"bufferView\"))\r\n            {\r\n                // if (sizeBufferViews.indexOf(gltf.json.images[i].hasOwnProperty(\"bufferView\")) == -1)console.log(\"image bufferview already there?!\");\r\n                // else\r\n                sizes.images += gltf.json.bufferViews[gltf.json.images[i].bufferView].byteLength;\r\n            }\r\n            else console.log(\"image has no bufferview?!\");\r\n\r\n            html += \"<tr>\";\r\n            html += \"<td>\" + gltf.json.images[i].name + \"</td>\";\r\n            html += \"<td>\" + gltf.json.images[i].mimeType + \"</td>\";\r\n            html += \"<td>\";\r\n\r\n            let name = gltf.json.images[i].name;\r\n            if (name === undefined)name = gltf.json.images[i].bufferView;\r\n\r\n            html += \"<a onclick=\\\"gui.corePatch().getOpById('\" + op.id + \"').exposeTexture('\" + name + \"')\\\" class=\\\"treebutton\\\">Expose</a>\";\r\n            html += \"</td>\";\r\n\r\n            html += \"<tr>\";\r\n        }\r\n        html += \"</table>\";\r\n    }\r\n\r\n    // / ///////////////////////\r\n\r\n    let numCameras = 0;\r\n    if (gltf.json.cameras)numCameras = gltf.json.cameras.length;\r\n    html += \"<div id=\\\"groupCameras\\\">Cameras (\" + numCameras + \")</div>\";\r\n\r\n    if (gltf.json.cameras)\r\n    {\r\n        html += \"<table id=\\\"sectionCameras\\\" class=\\\"table treetable\\\">\";\r\n\r\n        html += \"<tr>\";\r\n        html += \"  <th>name</th>\";\r\n        html += \"  <th>type</th>\";\r\n        html += \"  <th>info</th>\";\r\n        html += \"</tr>\";\r\n\r\n        for (let i = 0; i < gltf.json.cameras.length; i++)\r\n        {\r\n            html += \"<tr>\";\r\n            html += \"<td>\" + gltf.json.cameras[i].name + \"</td>\";\r\n            html += \"<td>\" + gltf.json.cameras[i].type + \"</td>\";\r\n            html += \"<td>\";\r\n\r\n            if (gltf.json.cameras[i].perspective)\r\n            {\r\n                html += \"yfov: \" + Math.round(gltf.json.cameras[i].perspective.yfov * 100) / 100;\r\n                html += \", \";\r\n                html += \"zfar: \" + Math.round(gltf.json.cameras[i].perspective.zfar * 100) / 100;\r\n                html += \", \";\r\n                html += \"znear: \" + Math.round(gltf.json.cameras[i].perspective.znear * 100) / 100;\r\n            }\r\n            html += \"</td>\";\r\n\r\n            html += \"<tr>\";\r\n        }\r\n        html += \"</table>\";\r\n    }\r\n\r\n    // / ////////////////////////////////////\r\n\r\n    let numSkins = 0;\r\n    if (gltf.json.skins)numSkins = gltf.json.skins.length;\r\n    html += \"<div id=\\\"groupSkins\\\">Skins (\" + numSkins + \")</div>\";\r\n\r\n    if (gltf.json.skins)\r\n    {\r\n        // html += \"<h3>Skins (\" + gltf.json.skins.length + \")</h3>\";\r\n        html += \"<table id=\\\"sectionSkins\\\" class=\\\"table treetable\\\">\";\r\n\r\n        html += \"<tr>\";\r\n        html += \"  <th>name</th>\";\r\n        html += \"  <th></th>\";\r\n        html += \"  <th>total joints</th>\";\r\n        html += \"</tr>\";\r\n\r\n        for (let i = 0; i < gltf.json.skins.length; i++)\r\n        {\r\n            html += \"<tr>\";\r\n            html += \"<td>\" + gltf.json.skins[i].name + \"</td>\";\r\n            html += \"<td>\" + \"</td>\";\r\n            html += \"<td>\" + gltf.json.skins[i].joints.length + \"</td>\";\r\n            html += \"<td>\";\r\n            html += \"</td>\";\r\n            html += \"<tr>\";\r\n        }\r\n        html += \"</table>\";\r\n    }\r\n\r\n    // / ////////////////////////////////////\r\n\r\n    if (gltf.timing)\r\n    {\r\n        html += \"<div id=\\\"groupTiming\\\">Debug Loading Timing </div>\";\r\n\r\n        html += \"<table id=\\\"sectionTiming\\\" class=\\\"table treetable\\\">\";\r\n\r\n        html += \"<tr>\";\r\n        html += \"  <th>task</th>\";\r\n        html += \"  <th>time used</th>\";\r\n        html += \"</tr>\";\r\n\r\n        let lt = 0;\r\n        for (let i = 0; i < gltf.timing.length - 1; i++)\r\n        {\r\n            html += \"<tr>\";\r\n            html += \"  <td>\" + gltf.timing[i][0] + \"</td>\";\r\n            html += \"  <td>\" + (gltf.timing[i + 1][1] - gltf.timing[i][1]) + \" ms</td>\";\r\n            html += \"</tr>\";\r\n            // lt = gltf.timing[i][1];\r\n        }\r\n        html += \"</table>\";\r\n    }\r\n\r\n    // / //////////////////////////\r\n\r\n    let sizeBin = 0;\r\n    if (gltf.json.buffers)\r\n        sizeBin = gltf.json.buffers[0].byteLength;\r\n\r\n    html += \"<div id=\\\"groupBinary\\\">File Size Allocation (\" + Math.round(sizeBin / 1024) + \"k )</div>\";\r\n\r\n    html += \"<table id=\\\"sectionBinary\\\" class=\\\"table treetable\\\">\";\r\n    html += \"<tr>\";\r\n    html += \"  <th>name</th>\";\r\n    html += \"  <th>size</th>\";\r\n    html += \"  <th>%</th>\";\r\n    html += \"</tr>\";\r\n    let sizeUnknown = sizeBin;\r\n    for (let i in sizes)\r\n    {\r\n        // html+=i+':'+Math.round(sizes[i]/1024);\r\n        html += \"<tr>\";\r\n        html += \"<td>\" + i + \"</td>\";\r\n        html += \"<td>\" + readableSize(sizes[i]) + \" </td>\";\r\n        html += \"<td>\" + Math.round(sizes[i] / sizeBin * 100) + \"% </td>\";\r\n        html += \"<tr>\";\r\n        sizeUnknown -= sizes[i];\r\n    }\r\n\r\n    if (sizeUnknown != 0)\r\n    {\r\n        html += \"<tr>\";\r\n        html += \"<td>unknown</td>\";\r\n        html += \"<td>\" + readableSize(sizeUnknown) + \" </td>\";\r\n        html += \"<td>\" + Math.round(sizeUnknown / sizeBin * 100) + \"% </td>\";\r\n        html += \"<tr>\";\r\n    }\r\n\r\n    html += \"</table>\";\r\n    html += \"</div>\";\r\n\r\n    tab = new CABLES.UI.Tab(\"GLTF \" + CABLES.basename(inFile.get()), { \"icon\": \"cube\", \"infotext\": \"tab_gltf\", \"padding\": true, \"singleton\": true });\r\n    gui.mainTabs.addTab(tab, true);\r\n\r\n    tab.addEventListener(\"close\", closeTab);\r\n    tab.html(html);\r\n\r\n    CABLES.UI.Collapsable.setup(ele.byId(\"groupNodes\"), ele.byId(\"sectionNodes\"), false);\r\n    CABLES.UI.Collapsable.setup(ele.byId(\"groupMaterials\"), ele.byId(\"materialtable\"), true);\r\n    CABLES.UI.Collapsable.setup(ele.byId(\"groupAnims\"), ele.byId(\"sectionAnim\"), true);\r\n    CABLES.UI.Collapsable.setup(ele.byId(\"groupMeshes\"), ele.byId(\"meshestable\"), true);\r\n    CABLES.UI.Collapsable.setup(ele.byId(\"groupCameras\"), ele.byId(\"sectionCameras\"), true);\r\n    CABLES.UI.Collapsable.setup(ele.byId(\"groupImages\"), ele.byId(\"sectionImages\"), true);\r\n    CABLES.UI.Collapsable.setup(ele.byId(\"groupSkins\"), ele.byId(\"sectionSkins\"), true);\r\n    CABLES.UI.Collapsable.setup(ele.byId(\"groupBinary\"), ele.byId(\"sectionBinary\"), true);\r\n    CABLES.UI.Collapsable.setup(ele.byId(\"groupTiming\"), ele.byId(\"sectionTiming\"), true);\r\n\r\n    gui.maintabPanel.show(true);\r\n}\r\n\r\nfunction readableSize(n)\r\n{\r\n    if (n > 1024) return Math.round(n / 1024) + \" kb\";\r\n    if (n > 1024 * 500) return Math.round(n / 1024) + \" mb\";\r\n    else return n + \" bytes\";\r\n}\r\n","inc_skin_js":"const GltfSkin = class\r\n{\r\n    constructor(node)\r\n    {\r\n        this._mod = null;\r\n        this._node = node;\r\n        this._lastTime = 0;\r\n        this._matArr = [];\r\n        this._m = mat4.create();\r\n        this._invBindMatrix = mat4.create();\r\n        this.identity = true;\r\n    }\r\n\r\n    renderFinish(cgl)\r\n    {\r\n        cgl.popModelMatrix();\r\n        this._mod.unbind();\r\n    }\r\n\r\n    renderStart(cgl, time)\r\n    {\r\n        if (!this._mod)\r\n        {\r\n            this._mod = new CGL.ShaderModifier(cgl, op.name + this._node.name);\r\n\r\n            this._mod.addModule({\r\n                \"priority\": -2,\r\n                \"name\": \"MODULE_VERTEX_POSITION\",\r\n                \"srcHeadVert\": attachments.skin_head_vert || \"\",\r\n                \"srcBodyVert\": attachments.skin_vert || \"\"\r\n            });\r\n\r\n            this._mod.addUniformVert(\"m4[]\", \"MOD_boneMats\", []);// bohnenmatze\r\n            const tr = vec3.create();\r\n        }\r\n\r\n        const skinIdx = this._node.skin;\r\n        const arrLength = gltf.json.skins[skinIdx].joints.length * 16;\r\n\r\n        // if (this._lastTime != time || !time)\r\n        {\r\n            // this._lastTime=inTime.get();\r\n            if (this._matArr.length != arrLength) this._matArr.length = arrLength;\r\n\r\n            for (let i = 0; i < gltf.json.skins[skinIdx].joints.length; i++)\r\n            {\r\n                const i16 = i * 16;\r\n                const jointIdx = gltf.json.skins[skinIdx].joints[i];\r\n                const nodeJoint = gltf.nodes[jointIdx];\r\n\r\n                for (let j = 0; j < 16; j++)\r\n                    this._invBindMatrix[j] = gltf.accBuffers[gltf.json.skins[skinIdx].inverseBindMatrices][i16 + j];\r\n\r\n                mat4.mul(this._m, nodeJoint.modelMatAbs(), this._invBindMatrix);\r\n\r\n                for (let j = 0; j < this._m.length; j++) this._matArr[i16 + j] = this._m[j];\r\n            }\r\n\r\n            this._mod.setUniformValue(\"MOD_boneMats\", this._matArr);\r\n            this._lastTime = time;\r\n        }\r\n\r\n        this._mod.define(\"SKIN_NUM_BONES\", gltf.json.skins[skinIdx].joints.length);\r\n        this._mod.bind();\r\n\r\n        // draw mesh...\r\n        cgl.pushModelMatrix();\r\n        if (this.identity)mat4.identity(cgl.mMatrix);\r\n    }\r\n};\r\n","inc_targets_js":"const GltfTargetsRenderer = class\r\n{\r\n    constructor(mesh)\r\n    {\r\n        this.mesh = mesh;\r\n        this.tex = null;\r\n        this.numRowsPerTarget = 0;\r\n\r\n        this.makeTex(mesh.geom);\r\n    }\r\n\r\n    renderFinish(cgl)\r\n    {\r\n        if (!cgl.gl) return;\r\n        cgl.popModelMatrix();\r\n        this._mod.unbind();\r\n    }\r\n\r\n    renderStart(cgl, time)\r\n    {\r\n        if (!cgl.gl) return;\r\n        if (!this._mod)\r\n        {\r\n            this._mod = new CGL.ShaderModifier(cgl, \"gltftarget\");\r\n\r\n            this._mod.addModule({\r\n                \"priority\": -2,\r\n                \"name\": \"MODULE_VERTEX_POSITION\",\r\n                \"srcHeadVert\": attachments.targets_head_vert || \"\",\r\n                \"srcBodyVert\": attachments.targets_vert || \"\"\r\n            });\r\n\r\n            this._mod.addUniformVert(\"4f\", \"MOD_targetTexInfo\", [0, 0, 0, 0]);\r\n            this._mod.addUniformVert(\"t\", \"MOD_targetTex\", 1);\r\n            this._mod.addUniformVert(\"f[]\", \"MOD_weights\", []);\r\n\r\n            const tr = vec3.create();\r\n        }\r\n\r\n        this._mod.pushTexture(\"MOD_targetTex\", this.tex);\r\n        if (this.tex && this.mesh.weights)\r\n        {\r\n            this._mod.setUniformValue(\"MOD_weights\", this.mesh.weights);\r\n            this._mod.setUniformValue(\"MOD_targetTexInfo\", [this.tex.width, this.tex.height, this.numRowsPerTarget, this.mesh.weights.length]);\r\n\r\n            this._mod.define(\"MOD_NUM_WEIGHTS\", Math.max(1, this.mesh.weights.length));\r\n        }\r\n        else\r\n        {\r\n            this._mod.define(\"MOD_NUM_WEIGHTS\", 1);\r\n        }\r\n        this._mod.bind();\r\n\r\n        // draw mesh...\r\n        cgl.pushModelMatrix();\r\n        if (this.identity)mat4.identity(cgl.mMatrix);\r\n    }\r\n\r\n    makeTex(geom)\r\n    {\r\n        if (!cgl.gl) return;\r\n\r\n        if (!geom.morphTargets || !geom.morphTargets.length) return;\r\n\r\n        let w = geom.morphTargets[0].vertices.length / 3;\r\n        let h = 0;\r\n        this.numRowsPerTarget = 0;\r\n\r\n        if (geom.morphTargets[0].vertices && geom.morphTargets[0].vertices.length) this.numRowsPerTarget++;\r\n        if (geom.morphTargets[0].vertexNormals && geom.morphTargets[0].vertexNormals.length) this.numRowsPerTarget++;\r\n        if (geom.morphTargets[0].tangents && geom.morphTargets[0].tangents.length) this.numRowsPerTarget++;\r\n        if (geom.morphTargets[0].bitangents && geom.morphTargets[0].bitangents.length) this.numRowsPerTarget++;\r\n\r\n        h = geom.morphTargets.length * this.numRowsPerTarget;\r\n\r\n        // console.log(\"this.numRowsPerTarget\", this.numRowsPerTarget);\r\n\r\n        const pixels = new Float32Array(w * h * 4);\r\n        let row = 0;\r\n\r\n        for (let i = 0; i < geom.morphTargets.length; i++)\r\n        {\r\n            if (geom.morphTargets[i].vertices && geom.morphTargets[i].vertices.length)\r\n            {\r\n                for (let j = 0; j < geom.morphTargets[i].vertices.length; j += 3)\r\n                {\r\n                    pixels[((row * w) + (j / 3)) * 4 + 0] = geom.morphTargets[i].vertices[j + 0];\r\n                    pixels[((row * w) + (j / 3)) * 4 + 1] = geom.morphTargets[i].vertices[j + 1];\r\n                    pixels[((row * w) + (j / 3)) * 4 + 2] = geom.morphTargets[i].vertices[j + 2];\r\n                    pixels[((row * w) + (j / 3)) * 4 + 3] = 1;\r\n                }\r\n                row++;\r\n            }\r\n\r\n            if (geom.morphTargets[i].vertexNormals && geom.morphTargets[i].vertexNormals.length)\r\n            {\r\n                for (let j = 0; j < geom.morphTargets[i].vertexNormals.length; j += 3)\r\n                {\r\n                    pixels[(row * w + j / 3) * 4 + 0] = geom.morphTargets[i].vertexNormals[j + 0];\r\n                    pixels[(row * w + j / 3) * 4 + 1] = geom.morphTargets[i].vertexNormals[j + 1];\r\n                    pixels[(row * w + j / 3) * 4 + 2] = geom.morphTargets[i].vertexNormals[j + 2];\r\n                    pixels[(row * w + j / 3) * 4 + 3] = 1;\r\n                }\r\n\r\n                row++;\r\n            }\r\n\r\n            if (geom.morphTargets[i].tangents && geom.morphTargets[i].tangents.length)\r\n            {\r\n                for (let j = 0; j < geom.morphTargets[i].tangents.length; j += 3)\r\n                {\r\n                    pixels[(row * w + j / 3) * 4 + 0] = geom.morphTargets[i].tangents[j + 0];\r\n                    pixels[(row * w + j / 3) * 4 + 1] = geom.morphTargets[i].tangents[j + 1];\r\n                    pixels[(row * w + j / 3) * 4 + 2] = geom.morphTargets[i].tangents[j + 2];\r\n                    pixels[(row * w + j / 3) * 4 + 3] = 1;\r\n                }\r\n                row++;\r\n            }\r\n\r\n            if (geom.morphTargets[i].bitangents && geom.morphTargets[i].bitangents.length)\r\n            {\r\n                for (let j = 0; j < geom.morphTargets[i].bitangents.length; j += 3)\r\n                {\r\n                    pixels[(row * w + j / 3) * 4 + 0] = geom.morphTargets[i].bitangents[j + 0];\r\n                    pixels[(row * w + j / 3) * 4 + 1] = geom.morphTargets[i].bitangents[j + 1];\r\n                    pixels[(row * w + j / 3) * 4 + 2] = geom.morphTargets[i].bitangents[j + 2];\r\n                    pixels[(row * w + j / 3) * 4 + 3] = 1;\r\n                }\r\n                row++;\r\n            }\r\n        }\r\n\r\n        this.tex = new CGL.Texture(cgl, { \"isFloatingPointTexture\": true, \"name\": \"targetsTexture\" });\r\n\r\n        this.tex.initFromData(pixels, w, h, CGL.Texture.FILTER_LINEAR, CGL.Texture.WRAP_REPEAT);\r\n\r\n        // console.log(\"morphTargets generated texture\", w, h);\r\n    }\r\n};\r\n","skin_vert":"int index=int(attrJoints.x);\r\nvec4 newPos = (MOD_boneMats[index] * pos) * attrWeights.x;\r\nvec3 newNorm = (vec4((MOD_boneMats[index] * vec4(norm.xyz, 0.0)) * attrWeights.x).xyz);\r\n\r\nindex=int(attrJoints.y);\r\nnewPos += (MOD_boneMats[index] * pos) * attrWeights.y;\r\nnewNorm = (vec4((MOD_boneMats[index] * vec4(norm.xyz, 0.0)) * attrWeights.y).xyz)+newNorm;\r\n\r\nindex=int(attrJoints.z);\r\nnewPos += (MOD_boneMats[index] * pos) * attrWeights.z;\r\nnewNorm = (vec4((MOD_boneMats[index] * vec4(norm.xyz, 0.0)) * attrWeights.z).xyz)+newNorm;\r\n\r\nindex=int(attrJoints.w);\r\nnewPos += (MOD_boneMats[index] * pos) * attrWeights.w ;\r\nnewNorm = (vec4((MOD_boneMats[index] * vec4(norm.xyz, 0.0)) * attrWeights.w).xyz)+newNorm;\r\n\r\npos=newPos;\r\n\r\nnorm=normalize(newNorm.xyz);\r\n\r\n\r\n","skin_head_vert":"\r\nIN vec4 attrWeights;\r\nIN vec4 attrJoints;\r\nUNI mat4 MOD_boneMats[SKIN_NUM_BONES];\r\n","targets_vert":"\r\n\r\nfloat MOD_width=MOD_targetTexInfo.x;\r\nfloat MOD_height=MOD_targetTexInfo.y;\r\nfloat MOD_numTargets=MOD_targetTexInfo.w;\r\nfloat MOD_numLinesPerTarget=MOD_height/MOD_numTargets;\r\n\r\nfloat halfpix=(1.0/MOD_width)*0.5;\r\nfloat halfpixy=(1.0/MOD_height)*0.5;\r\n\r\nfloat x=(attrVertIndex)/MOD_width+halfpix;\r\n\r\nvec3 off=vec3(0.0);\r\n\r\nfor(float i=0.0;i<MOD_numTargets;i+=1.0)\r\n{\r\n    float y=1.0-((MOD_numLinesPerTarget*i)/MOD_height+halfpixy);\r\n    vec2 coord=vec2(x,y);\r\n    vec3 targetXYZ = texture(MOD_targetTex,coord).xyz;\r\n\r\n    off+=(targetXYZ*MOD_weights[int(i)]);\r\n\r\n\r\n\r\n    coord.y+=1.0/MOD_height; // normals are in next row\r\n    vec3 targetNormal = texture(MOD_targetTex,coord).xyz;\r\n    norm+=targetNormal*MOD_weights[int(i)];\r\n\r\n\r\n}\r\n\r\n// norm=normalize(norm);\r\npos.xyz+=off;\r\n","targets_head_vert":"\r\nUNI float MOD_weights[MOD_NUM_WEIGHTS];\r\n",};
const gltfCamera = class
{
    constructor(gltf, node)
    {
        this.node = node;
        this.name = node.name;
        // console.log(gltf);
        this.config = gltf.json.cameras[node.camera];

        this.pos = vec3.create();
        this.quat = quat.create();
        this.vCenter = vec3.create();
        this.vUp = vec3.create();
        this.vMat = mat4.create();
    }

    updateAnim(time)
    {
        if (this.node && this.node._animTrans)
        {
            vec3.set(this.pos,
                this.node._animTrans[0].getValue(time),
                this.node._animTrans[1].getValue(time),
                this.node._animTrans[2].getValue(time));

            quat.set(this.quat,
                this.node._animRot[0].getValue(time),
                this.node._animRot[1].getValue(time),
                this.node._animRot[2].getValue(time),
                this.node._animRot[3].getValue(time));
        }
    }

    start(time)
    {
        if (cgl.tempData.shadowPass) return;

        this.updateAnim(time);
        const asp = cgl.getViewPort()[2] / cgl.getViewPort()[3];

        cgl.pushPMatrix();
        // mat4.perspective(
        //     cgl.pMatrix,
        //     this.config.perspective.yfov*0.5,
        //     asp,
        //     this.config.perspective.znear,
        //     this.config.perspective.zfar);

        cgl.pushViewMatrix();
        // mat4.identity(cgl.vMatrix);

        // if(this.node && this.node.parent)
        // {
        //     console.log(this.node.parent)
        // vec3.add(this.pos,this.pos,this.node.parent._node.translation);
        // vec3.sub(this.vCenter,this.vCenter,this.node.parent._node.translation);
        // mat4.translate(cgl.vMatrix,cgl.vMatrix,
        // [
        //     -this.node.parent._node.translation[0],
        //     -this.node.parent._node.translation[1],
        //     -this.node.parent._node.translation[2]
        // ])
        // }

        // vec3.set(this.vUp, 0, 1, 0);
        // vec3.set(this.vCenter, 0, -1, 0);
        // // vec3.set(this.vCenter, 0, 1, 0);
        // vec3.transformQuat(this.vCenter, this.vCenter, this.quat);
        // vec3.normalize(this.vCenter, this.vCenter);
        // vec3.add(this.vCenter, this.vCenter, this.pos);

        // mat4.lookAt(cgl.vMatrix, this.pos, this.vCenter, this.vUp);

        let mv = mat4.create();
        mat4.invert(mv, this.node.modelMatAbs());

        // console.log(this.node.modelMatAbs());

        this.vMat = mv;

        mat4.identity(cgl.vMatrix);
        // console.log(mv);
        mat4.mul(cgl.vMatrix, cgl.vMatrix, mv);
    }

    end()
    {
        if (cgl.tempData.shadowPass) return;
        cgl.popPMatrix();
        cgl.popViewMatrix();
    }
};
const le = true; // little endian

const Gltf = class
{
    constructor()
    {
        this.json = {};
        this.accBuffers = [];
        this.meshes = [];
        this.nodes = [];
        this.shaders = [];
        this.timing = [];
        this.cams = [];
        this.startTime = performance.now();
        this.bounds = new CABLES.CG.BoundingBox();
        this.loaded = Date.now();
        this.accBuffersDelete = [];
    }

    getNode(n)
    {
        for (let i = 0; i < this.nodes.length; i++)
        {
            if (this.nodes[i].name == n) return this.nodes[i];
        }
    }

    unHideAll()
    {
        for (let i = 0; i < this.nodes.length; i++)
        {
            this.nodes[i].unHide();
        }
    }
};

function Utf8ArrayToStr(array)
{
    if (window.TextDecoder) return new TextDecoder("utf-8").decode(array);

    let out, i, len, c;
    let char2, char3;

    out = "";
    len = array.length;
    i = 0;
    while (i < len)
    {
        c = array[i++];
        switch (c >> 4)
        {
        case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
            // 0xxxxxxx
            out += String.fromCharCode(c);
            break;
        case 12: case 13:
            // 110x xxxx   10xx xxxx
            char2 = array[i++];
            out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
            break;
        case 14:
            // 1110 xxxx  10xx xxxx  10xx xxxx
            char2 = array[i++];
            char3 = array[i++];
            out += String.fromCharCode(((c & 0x0F) << 12) |
                    ((char2 & 0x3F) << 6) |
                    ((char3 & 0x3F) << 0));
            break;
        }
    }

    return out;
}

function readChunk(dv, bArr, arrayBuffer, offset)
{
    const chunk = {};

    if (offset >= dv.byteLength)
    {
        // op.log("could not read chunk...");
        return;
    }
    chunk.size = dv.getUint32(offset + 0, le);

    // chunk.type = new TextDecoder("utf-8").decode(bArr.subarray(offset+4, offset+4+4));
    chunk.type = Utf8ArrayToStr(bArr.subarray(offset + 4, offset + 4 + 4));

    if (chunk.type == "BIN\0")
    {
        // console.log(chunk.size,arrayBuffer.length,offset);
        // try
        // {
        chunk.dataView = new DataView(arrayBuffer, offset + 8, chunk.size);
        // }
        // catch(e)
        // {
        //     chunk.dataView = null;
        //     console.log(e);
        // }
    }
    else
    if (chunk.type == "JSON")
    {
        const json = Utf8ArrayToStr(bArr.subarray(offset + 8, offset + 8 + chunk.size));

        try
        {
            const obj = JSON.parse(json);
            chunk.data = obj;
            outGenerator.set(obj.asset.generator);
        }
        catch (e)
        {
        }
    }
    else
    {
        op.warn("unknown type", chunk.type);
    }

    return chunk;
}

function loadAnims(gltf)
{
    const uniqueAnimNames = {};
    maxTimeDict = {};

    for (let i = 0; i < gltf.json.animations.length; i++)
    {
        const an = gltf.json.animations[i];

        an.name = an.name || "unknown";

        for (let ia = 0; ia < an.channels.length; ia++)
        {
            const chan = an.channels[ia];

            const node = gltf.nodes[chan.target.node];
            const sampler = an.samplers[chan.sampler];

            const acc = gltf.json.accessors[sampler.input];
            const bufferIn = gltf.accBuffers[sampler.input];

            const accOut = gltf.json.accessors[sampler.output];
            const bufferOut = gltf.accBuffers[sampler.output];

            gltf.accBuffersDelete.push(sampler.output, sampler.input);

            if (bufferIn && bufferOut)
            {
                let numComps = 1;
                if (accOut.type === "VEC2")numComps = 2;
                else if (accOut.type === "VEC3")numComps = 3;
                else if (accOut.type === "VEC4")numComps = 4;
                else if (accOut.type === "SCALAR")
                {
                    numComps = bufferOut.length / bufferIn.length; // is this really the way to find out ? cant find any other way,except number of morph targets, but not really connected...
                }
                else op.log("[] UNKNOWN accOut.type", accOut.type);

                const anims = [];

                uniqueAnimNames[an.name] = true;

                for (let k = 0; k < numComps; k++)
                {
                    const newAnim = new CABLES.Anim();
                    // newAnim.name=an.name;
                    anims.push(newAnim);
                }

                if (sampler.interpolation === "LINEAR") {}
                else if (sampler.interpolation === "STEP") for (let k = 0; k < numComps; k++) anims[k].defaultEasing = CABLES.EASING_ABSOLUTE;
                else if (sampler.interpolation === "CUBICSPLINE") for (let k = 0; k < numComps; k++) anims[k].defaultEasing = CABLES.EASING_CUBICSPLINE;
                else op.warn("unknown interpolation", sampler.interpolation);

                // console.log(bufferOut)

                // if there is no keyframe for time 0 copy value of first keyframe at time 0
                if (bufferIn[0] !== 0.0)
                    for (let k = 0; k < numComps; k++)
                        anims[k].setValue(0, bufferOut[0 * numComps + k]);

                for (let j = 0; j < bufferIn.length; j++)
                {
                    // maxTime = Math.max(bufferIn[j], maxTime);
                    maxTimeDict[an.name] = bufferIn[j];

                    for (let k = 0; k < numComps; k++)
                    {
                        if (anims[k].defaultEasing === CABLES.EASING_CUBICSPLINE)
                        {
                            const idx = ((j * numComps) * 3 + k);

                            const key = anims[k].setValue(bufferIn[j], bufferOut[idx + numComps]);
                            key.bezTangIn = bufferOut[idx];
                            key.bezTangOut = bufferOut[idx + (numComps * 2)];

                            // console.log(an.name,k,bufferOut[idx+1]);
                        }
                        else
                        {
                            // console.log(an.name,k,bufferOut[j * numComps + k]);
                            anims[k].setValue(bufferIn[j], bufferOut[j * numComps + k]);
                        }
                    }
                }

                node.setAnim(chan.target.path, an.name, anims);
            }
            else
            {
                op.warn("loadAmins bufferIn undefined ", bufferIn === undefined);
                op.warn("loadAmins bufferOut undefined ", bufferOut === undefined);
                op.warn("loadAmins ", an.name, sampler, accOut);
                op.warn("loadAmins num accBuffers", gltf.accBuffers.length);
                op.warn("loadAmins num accessors", gltf.json.accessors.length);
            }
        }
    }

    gltf.uniqueAnimNames = uniqueAnimNames;

    outAnims.setRef(Object.keys(uniqueAnimNames));
}

function loadCams(gltf)
{
    if (!gltf || !gltf.json.cameras) return;

    gltf.cameras = gltf.cameras || [];

    for (let i = 0; i < gltf.nodes.length; i++)
    {
        if (gltf.nodes[i].hasOwnProperty("camera"))
        {
            const cam = new gltfCamera(gltf, gltf.nodes[i]);
            gltf.cameras.push(cam);
        }
    }
}

function loadAfterDraco()
{
    if (!window.DracoDecoder)
    {
        setTimeout(() =>
        {
            loadAfterDraco();
        }, 100);
    }

    reloadSoon();
}

function parseGltf(arrayBuffer)
{
    const CHUNK_HEADER_SIZE = 8;

    let j = 0, i = 0;

    const gltf = new Gltf();
    gltf.timing.push(["Start parsing", Math.round((performance.now() - gltf.startTime))]);

    if (!arrayBuffer) return;
    const byteArray = new Uint8Array(arrayBuffer);
    let pos = 0;

    // var string = new TextDecoder("utf-8").decode(byteArray.subarray(pos, 4));
    const string = Utf8ArrayToStr(byteArray.subarray(pos, 4));
    pos += 4;
    if (string != "glTF") return;

    gltf.timing.push(["dataview", Math.round((performance.now() - gltf.startTime))]);

    const dv = new DataView(arrayBuffer);
    const version = dv.getUint32(pos, le);
    pos += 4;
    const size = dv.getUint32(pos, le);
    pos += 4;

    outVersion.set(version);

    const chunks = [];
    gltf.chunks = chunks;

    chunks.push(readChunk(dv, byteArray, arrayBuffer, pos));
    pos += chunks[0].size + CHUNK_HEADER_SIZE;
    gltf.json = chunks[0].data;

    gltf.cables = {
        "fileUrl": inFile.get(),
        "shortFileName": CABLES.basename(inFile.get())
    };

    outJson.setRef(gltf.json);
    outExtensions.setRef(gltf.json.extensionsUsed || []);

    let ch = readChunk(dv, byteArray, arrayBuffer, pos);
    while (ch)
    {
        chunks.push(ch);
        pos += ch.size + CHUNK_HEADER_SIZE;
        ch = readChunk(dv, byteArray, arrayBuffer, pos);
    }

    gltf.chunks = chunks;

    const views = chunks[0].data.bufferViews;
    const accessors = chunks[0].data.accessors;

    gltf.timing.push(["Parse buffers", Math.round((performance.now() - gltf.startTime))]);

    if (gltf.json.extensionsUsed && gltf.json.extensionsUsed.indexOf("KHR_draco_mesh_compression") > -1)
    {
        if (!window.DracoDecoder)
        {
            op.setUiError("gltfdraco", "GLTF draco compression lib not found / add draco op to your patch!");

            loadAfterDraco();
            return gltf;
        }
        else
        {
            gltf.useDraco = true;
        }
    }

    op.setUiError("gltfdraco", null);
    // let accPos = (view.byteOffset || 0) + (acc.byteOffset || 0);

    if (views)
    {
        for (i = 0; i < accessors.length; i++)
        {
            const acc = accessors[i];
            const view = views[acc.bufferView];

            let numComps = 0;
            if (acc.type == "SCALAR")numComps = 1;
            else if (acc.type == "VEC2")numComps = 2;
            else if (acc.type == "VEC3")numComps = 3;
            else if (acc.type == "VEC4")numComps = 4;
            else if (acc.type == "MAT4")numComps = 16;
            else console.error("unknown accessor type", acc.type);

            //   const decoder = new decoderModule.Decoder();
            //   const decodedGeometry = decodeDracoData(data, decoder);
            //   // Encode mesh
            //   encodeMeshToFile(decodedGeometry, decoder);

            //   decoderModule.destroy(decoder);
            //   decoderModule.destroy(decodedGeometry);

            // 5120 (BYTE)	1
            // 5121 (UNSIGNED_BYTE)	1
            // 5122 (SHORT)	2

            if (chunks[1].dataView)
            {
                if (view)
                {
                    const num = acc.count * numComps;
                    let accPos = (view.byteOffset || 0) + (acc.byteOffset || 0);
                    let stride = view.byteStride || 0;
                    let dataBuff = null;

                    if (acc.componentType == 5126 || acc.componentType == 5125) // 4byte FLOAT or INT
                    {
                        stride = stride || 4;

                        const isInt = acc.componentType == 5125;
                        if (isInt)dataBuff = new Uint32Array(num);
                        else dataBuff = new Float32Array(num);

                        dataBuff.cblStride = numComps;

                        for (j = 0; j < num; j++)
                        {
                            if (isInt) dataBuff[j] = chunks[1].dataView.getUint32(accPos, le);
                            else dataBuff[j] = chunks[1].dataView.getFloat32(accPos, le);

                            if (stride != 4 && (j + 1) % numComps === 0)accPos += stride - (numComps * 4);
                            accPos += 4;
                        }
                    }
                    else if (acc.componentType == 5123) // UNSIGNED_SHORT
                    {
                        stride = stride || 2;

                        dataBuff = new Uint16Array(num);
                        dataBuff.cblStride = stride;

                        for (j = 0; j < num; j++)
                        {
                            dataBuff[j] = chunks[1].dataView.getUint16(accPos, le);

                            if (stride != 2 && (j + 1) % numComps === 0) accPos += stride - (numComps * 2);

                            accPos += 2;
                        }
                    }
                    else if (acc.componentType == 5121) // UNSIGNED_BYTE
                    {
                        stride = stride || 1;

                        dataBuff = new Uint8Array(num);
                        dataBuff.cblStride = stride;

                        for (j = 0; j < num; j++)
                        {
                            dataBuff[j] = chunks[1].dataView.getUint8(accPos, le);

                            if (stride != 1 && (j + 1) % numComps === 0) accPos += stride - (numComps * 1);

                            accPos += 1;
                        }
                    }

                    else
                    {
                        console.error("unknown component type", acc.componentType);
                    }

                    gltf.accBuffers.push(dataBuff);
                }
                else
                {
                    // console.log("has no dataview");
                }
            }
        }
    }

    gltf.timing.push(["Parse mesh groups", Math.round((performance.now() - gltf.startTime))]);

    gltf.json.meshes = gltf.json.meshes || [];

    if (gltf.json.meshes)
    {
        for (i = 0; i < gltf.json.meshes.length; i++)
        {
            const mesh = new gltfMeshGroup(gltf, gltf.json.meshes[i]);
            gltf.meshes.push(mesh);
        }
    }

    gltf.timing.push(["Parse nodes", Math.round((performance.now() - gltf.startTime))]);

    for (i = 0; i < gltf.json.nodes.length; i++)
    {
        if (gltf.json.nodes[i].children)
            for (j = 0; j < gltf.json.nodes[i].children.length; j++)
            {
                gltf.json.nodes[gltf.json.nodes[i].children[j]].isChild = true;
            }
    }

    for (i = 0; i < gltf.json.nodes.length; i++)
    {
        const node = new gltfNode(gltf.json.nodes[i], gltf);
        gltf.nodes.push(node);
    }

    for (i = 0; i < gltf.nodes.length; i++)
    {
        const node = gltf.nodes[i];

        if (!node.children) continue;
        for (let j = 0; j < node.children.length; j++)
        {
            gltf.nodes[node.children[j]].parent = node;
        }
    }

    for (i = 0; i < gltf.nodes.length; i++)
    {
        gltf.nodes[i].initSkin();
    }

    needsMatUpdate = true;

    gltf.timing.push(["load anims", Math.round((performance.now() - gltf.startTime))]);

    if (gltf.json.animations) loadAnims(gltf);

    gltf.timing.push(["load cameras", Math.round((performance.now() - gltf.startTime))]);

    if (gltf.json.cameras) loadCams(gltf);

    gltf.timing.push(["finished", Math.round((performance.now() - gltf.startTime))]);
    return gltf;
}
let gltfMesh = class
{
    constructor(name, prim, gltf, finished)
    {
        this.POINTS = 0;
        this.LINES = 1;
        this.LINE_LOOP = 2;
        this.LINE_STRIP = 3;
        this.TRIANGLES = 4;
        this.TRIANGLE_STRIP = 5;
        this.TRIANGLE_FAN = 6;

        this.test = 0;
        this.name = name;
        this.submeshIndex = 0;
        this.material = prim.material;
        this.mesh = null;
        this.geom = new CGL.Geometry("gltf_" + this.name);
        this.geom.verticesIndices = [];
        this.bounds = null;
        this.primitive = 4;
        this.morphTargetsRenderMod = null;
        this.weights = prim.weights;

        if (prim.hasOwnProperty("mode")) this.primitive = prim.mode;

        if (prim.hasOwnProperty("indices")) this.geom.verticesIndices = gltf.accBuffers[prim.indices];

        gltf.loadingMeshes = gltf.loadingMeshes || 0;
        gltf.loadingMeshes++;

        this.materialJson =
            this._matPbrMetalness =
            this._matPbrRoughness =
            this._matDiffuseColor = null;

        if (gltf.json.materials)
        {
            if (this.material != -1) this.materialJson = gltf.json.materials[this.material];

            if (this.materialJson && this.materialJson.pbrMetallicRoughness)
            {
                if (!this.materialJson.pbrMetallicRoughness.hasOwnProperty("baseColorFactor"))
                {
                    this._matDiffuseColor = [1, 1, 1, 1];
                }
                else
                {
                    this._matDiffuseColor = this.materialJson.pbrMetallicRoughness.baseColorFactor;
                }

                this._matDiffuseColor = this.materialJson.pbrMetallicRoughness.baseColorFactor;

                if (!this.materialJson.pbrMetallicRoughness.hasOwnProperty("metallicFactor"))
                {
                    this._matPbrMetalness = 1.0;
                }
                else
                {
                    this._matPbrMetalness = this.materialJson.pbrMetallicRoughness.metallicFactor || null;
                }

                if (!this.materialJson.pbrMetallicRoughness.hasOwnProperty("roughnessFactor"))
                {
                    this._matPbrRoughness = 1.0;
                }
                else
                {
                    this._matPbrRoughness = this.materialJson.pbrMetallicRoughness.roughnessFactor || null;
                }
            }
        }

        if (gltf.useDraco && prim.extensions.KHR_draco_mesh_compression)
        {
            const view = gltf.chunks[0].data.bufferViews[prim.extensions.KHR_draco_mesh_compression.bufferView];
            const num = view.byteLength;
            const dataBuff = new Int8Array(num);
            let accPos = (view.byteOffset || 0);// + (acc.byteOffset || 0);
            for (let j = 0; j < num; j++)
            {
                dataBuff[j] = gltf.chunks[1].dataView.getInt8(accPos, le);
                accPos++;
            }

            const dracoDecoder = window.DracoDecoder;
            dracoDecoder.decodeGeometry(dataBuff.buffer, (geometry) =>
            {
                const geom = new CGL.Geometry("draco mesh " + name);

                for (let i = 0; i < geometry.attributes.length; i++)
                {
                    const attr = geometry.attributes[i];

                    if (attr.name === "position") geom.vertices = attr.array;
                    else if (attr.name === "normal") geom.vertexNormals = attr.array;
                    else if (attr.name === "uv") geom.texCoords = attr.array;
                    else if (attr.name === "color") geom.vertexColors = this.calcVertexColors(attr.array);
                    else if (attr.name === "joints") geom.setAttribute("attrJoints", Array.from(attr.array), 4);
                    else if (attr.name === "weights")
                    {
                        const arr4 = new Float32Array(attr.array.length / attr.itemSize * 4);

                        for (let k = 0; k < attr.array.length / attr.itemSize; k++)
                        {
                            arr4[k * 4] = arr4[k * 4 + 1] = arr4[k * 4 + 2] = arr4[k * 4 + 3] = 0;
                            for (let j = 0; j < attr.itemSize; j++)
                                arr4[k * 4 + j] = attr.array[k * attr.itemSize + j];
                        }
                        geom.setAttribute("attrWeights", arr4, 4);
                    }
                    else op.logWarn("unknown draco attrib", attr);
                }

                geometry.attributes = null;
                geom.verticesIndices = geometry.index.array;

                this.setGeom(geom);

                this.mesh = null;
                gltf.loadingMeshes--;
                gltf.timing.push(["draco decode", Math.round((performance.now() - gltf.startTime))]);

                if (finished)finished(this);
            }, (error) => { op.logError(error); });
        }
        else
        {
            gltf.loadingMeshes--;
            this.fillGeomAttribs(gltf, this.geom, prim.attributes);

            if (prim.targets)
            {
                for (let j = 0; j < prim.targets.length; j++)
                {
                    const tgeom = new CGL.Geometry("gltf_target_" + j);

                    // if (prim.hasOwnProperty("indices")) tgeom.verticesIndices = gltf.accBuffers[prim.indices];

                    this.fillGeomAttribs(gltf, tgeom, prim.targets[j], false);

                    // { // calculate normals for final position of morphtarget for later...
                    //     for (let i = 0; i < tgeom.vertices.length; i++) tgeom.vertices[i] += this.geom.vertices[i];
                    //     tgeom.calculateNormals();
                    //     for (let i = 0; i < tgeom.vertices.length; i++) tgeom.vertices[i] -= this.geom.vertices[i];
                    // }

                    this.geom.morphTargets.push(tgeom);
                }
            }
            if (finished)finished(this);
        }
    }

    _linearToSrgb(x)
    {
        if (x <= 0)
            return 0;
        else if (x >= 1)
            return 1;
        else if (x < 0.0031308)
            return x * 12.92;
        else
            return x ** (1 / 2.2) * 1.055 - 0.055;
    }

    calcVertexColors(arr, type)
    {
        let vertexColors = null;
        if (arr instanceof Float32Array)
        {
            let div = false;
            for (let i = 0; i < arr.length; i++)
            {
                if (arr[i] > 1)
                {
                    div = true;
                    continue;
                }
            }

            if (div)
                for (let i = 0; i < arr.length; i++) arr[i] /= 65535;

            vertexColors = arr;
        }

        else if (arr instanceof Uint16Array)
        {
            const fb = new Float32Array(arr.length);
            for (let i = 0; i < arr.length; i++) fb[i] = arr[i] / 65535;

            vertexColors = fb;
        }
        else vertexColors = arr;

        for (let i = 0; i < vertexColors.length; i++)
        {
            vertexColors[i] = this._linearToSrgb(vertexColors[i]);
        }

        if (arr.cblStride == 3)
        {
            const nc = new Float32Array(vertexColors.length / 3 * 4);
            for (let i = 0; i < vertexColors.length / 3; i++)
            {
                nc[i * 4 + 0] = vertexColors[i * 3 + 0];
                nc[i * 4 + 1] = vertexColors[i * 3 + 1];
                nc[i * 4 + 2] = vertexColors[i * 3 + 2];
                nc[i * 4 + 3] = 1;
            }
            vertexColors = nc;
        }

        return vertexColors;
    }

    fillGeomAttribs(gltf, tgeom, attribs, setGeom)
    {
        if (attribs.hasOwnProperty("POSITION")) tgeom.vertices = gltf.accBuffers[attribs.POSITION];
        if (attribs.hasOwnProperty("NORMAL")) tgeom.vertexNormals = gltf.accBuffers[attribs.NORMAL];
        if (attribs.hasOwnProperty("TANGENT")) tgeom.tangents = gltf.accBuffers[attribs.TANGENT];

        // // console.log(gltf.accBuffers[attribs.COLOR_0])
        // console.log(gltf);

        if (attribs.hasOwnProperty("COLOR_0")) tgeom.vertexColors = this.calcVertexColors(gltf.accBuffers[attribs.COLOR_0], gltf.accBuffers[attribs.COLOR_0].type);
        if (attribs.hasOwnProperty("COLOR_1")) tgeom.setAttribute("attrVertColor1", this.calcVertexColors(gltf.accBuffers[attribs.COLOR_1]), gltf.accBuffers[attribs.COLOR_1].type);
        if (attribs.hasOwnProperty("COLOR_2")) tgeom.setAttribute("attrVertColor2", this.calcVertexColors(gltf.accBuffers[attribs.COLOR_2]), gltf.accBuffers[attribs.COLOR_2].type);
        if (attribs.hasOwnProperty("COLOR_3")) tgeom.setAttribute("attrVertColor3", this.calcVertexColors(gltf.accBuffers[attribs.COLOR_3]), gltf.accBuffers[attribs.COLOR_3].type);
        if (attribs.hasOwnProperty("COLOR_4")) tgeom.setAttribute("attrVertColor4", this.calcVertexColors(gltf.accBuffers[attribs.COLOR_4]), gltf.accBuffers[attribs.COLOR_4].type);

        if (attribs.hasOwnProperty("TEXCOORD_0")) tgeom.texCoords = gltf.accBuffers[attribs.TEXCOORD_0];
        if (attribs.hasOwnProperty("TEXCOORD_1")) tgeom.setAttribute("attrTexCoord1", gltf.accBuffers[attribs.TEXCOORD_1], 2);
        if (attribs.hasOwnProperty("TEXCOORD_2")) tgeom.setAttribute("attrTexCoord2", gltf.accBuffers[attribs.TEXCOORD_2], 2);
        if (attribs.hasOwnProperty("TEXCOORD_3")) tgeom.setAttribute("attrTexCoord3", gltf.accBuffers[attribs.TEXCOORD_3], 2);
        if (attribs.hasOwnProperty("TEXCOORD_4")) tgeom.setAttribute("attrTexCoord4", gltf.accBuffers[attribs.TEXCOORD_4], 2);

        if (attribs.hasOwnProperty("WEIGHTS_0"))
        {
            tgeom.setAttribute("attrWeights", gltf.accBuffers[attribs.WEIGHTS_0], 4);
        }
        if (attribs.hasOwnProperty("JOINTS_0"))
        {
            if (!gltf.accBuffers[attribs.JOINTS_0])console.log("no !gltf.accBuffers[attribs.JOINTS_0]");
            tgeom.setAttribute("attrJoints", gltf.accBuffers[attribs.JOINTS_0], 4);
        }

        if (attribs.hasOwnProperty("POSITION")) gltf.accBuffersDelete.push(attribs.POSITION);
        if (attribs.hasOwnProperty("NORMAL")) gltf.accBuffersDelete.push(attribs.NORMAL);
        if (attribs.hasOwnProperty("TEXCOORD_0")) gltf.accBuffersDelete.push(attribs.TEXCOORD_0);
        if (attribs.hasOwnProperty("TANGENT")) gltf.accBuffersDelete.push(attribs.TANGENT);
        if (attribs.hasOwnProperty("COLOR_0"))gltf.accBuffersDelete.push(attribs.COLOR_0);
        if (attribs.hasOwnProperty("COLOR_0"))gltf.accBuffersDelete.push(attribs.COLOR_0);
        if (attribs.hasOwnProperty("COLOR_1"))gltf.accBuffersDelete.push(attribs.COLOR_1);
        if (attribs.hasOwnProperty("COLOR_2"))gltf.accBuffersDelete.push(attribs.COLOR_2);
        if (attribs.hasOwnProperty("COLOR_3"))gltf.accBuffersDelete.push(attribs.COLOR_3);

        if (attribs.hasOwnProperty("TEXCOORD_1")) gltf.accBuffersDelete.push(attribs.TEXCOORD_1);
        if (attribs.hasOwnProperty("TEXCOORD_2")) gltf.accBuffersDelete.push(attribs.TEXCOORD_2);
        if (attribs.hasOwnProperty("TEXCOORD_3")) gltf.accBuffersDelete.push(attribs.TEXCOORD_3);
        if (attribs.hasOwnProperty("TEXCOORD_4")) gltf.accBuffersDelete.push(attribs.TEXCOORD_4);

        if (setGeom !== false) if (tgeom && tgeom.verticesIndices) this.setGeom(tgeom);
    }

    setGeom(geom)
    {
        if (inNormFormat.get() == "X-ZY")
        {
            for (let i = 0; i < geom.vertexNormals.length; i += 3)
            {
                let t = geom.vertexNormals[i + 2];
                geom.vertexNormals[i + 2] = geom.vertexNormals[i + 1];
                geom.vertexNormals[i + 1] = -t;
            }
        }

        if (inVertFormat.get() == "XZ-Y")
        {
            for (let i = 0; i < geom.vertices.length; i += 3)
            {
                let t = geom.vertices[i + 2];
                geom.vertices[i + 2] = -geom.vertices[i + 1];
                geom.vertices[i + 1] = t;
            }
        }

        if (this.primitive == this.TRIANGLES)
        {
            if (inCalcNormals.get() == "Force Smooth" || inCalcNormals.get() == false) geom.calculateNormals();
            else if (!geom.vertexNormals.length && inCalcNormals.get() == "Auto") geom.calculateNormals({ "smooth": false });

            if ((!geom.biTangents || geom.biTangents.length == 0) && geom.tangents)
            {
                const bitan = vec3.create();
                const tan = vec3.create();

                const tangents = geom.tangents;
                geom.tangents = new Float32Array(tangents.length / 4 * 3);
                geom.biTangents = new Float32Array(tangents.length / 4 * 3);

                for (let i = 0; i < tangents.length; i += 4)
                {
                    const idx = i / 4 * 3;

                    vec3.cross(
                        bitan,
                        [geom.vertexNormals[idx], geom.vertexNormals[idx + 1], geom.vertexNormals[idx + 2]],
                        [tangents[i], tangents[i + 1], tangents[i + 2]]
                    );

                    vec3.div(bitan, bitan, [tangents[i + 3], tangents[i + 3], tangents[i + 3]]);
                    vec3.normalize(bitan, bitan);

                    geom.biTangents[idx + 0] = bitan[0];
                    geom.biTangents[idx + 1] = bitan[1];
                    geom.biTangents[idx + 2] = bitan[2];

                    geom.tangents[idx + 0] = tangents[i + 0];
                    geom.tangents[idx + 1] = tangents[i + 1];
                    geom.tangents[idx + 2] = tangents[i + 2];
                }
            }

            if (geom.tangents.length === 0 || inCalcNormals.get() != "Never")
            {
                // console.log("[gltf ]no tangents... calculating tangents...");
                geom.calcTangentsBitangents();
            }
        }

        this.geom = geom;

        this.bounds = geom.getBounds();
    }

    render(cgl, ignoreMaterial, skinRenderer)
    {
        if (!this.mesh && this.geom && this.geom.verticesIndices)
        {
            let g = this.geom;
            if (this.geom.vertices.length / 3 > 64000 && this.geom.verticesIndices.length > 0)
            {
                g = this.geom.copy();
                g.unIndex(false, true);
            }

            let glprim;

            if (cgl.gl)
            {
                if (this.primitive == this.TRIANGLES)glprim = cgl.gl.TRIANGLES;
                else if (this.primitive == this.LINES)glprim = cgl.gl.LINES;
                else if (this.primitive == this.LINE_STRIP)glprim = cgl.gl.LINE_STRIP;
                else if (this.primitive == this.POINTS)glprim = cgl.gl.POINTS;
                else
                {
                    op.logWarn("unknown primitive type", this);
                }
            }

            this.mesh = op.patch.cg.createMesh(g, { "glPrimitive": glprim });
        }

        if (this.mesh)
        {
            // update morphTargets
            if (this.geom && this.geom.morphTargets.length && !this.morphTargetsRenderMod)
            {
                this.mesh.addVertexNumbers = true;
                this.morphTargetsRenderMod = new GltfTargetsRenderer(this);
            }

            let useMat = !ignoreMaterial && this.material != -1 && gltf.shaders[this.material];
            if (skinRenderer)useMat = false;

            if (useMat) cgl.pushShader(gltf.shaders[this.material]);

            const currentShader = cgl.getShader() || {};
            const uniDiff = currentShader.uniformColorDiffuse;

            const uniPbrMetalness = currentShader.uniformPbrMetalness;
            const uniPbrRoughness = currentShader.uniformPbrRoughness;

            // if (gltf.shaders[this.material] && !inUseMatProps.get())
            // {
            //     gltf.shaders[this.material]=null;
            // }

            if (!gltf.shaders[this.material] && inUseMatProps.get())
            {
                if (uniDiff && this._matDiffuseColor)
                {
                    this._matDiffuseColorOrig = [uniDiff.getValue()[0], uniDiff.getValue()[1], uniDiff.getValue()[2], uniDiff.getValue()[3]];
                    uniDiff.setValue(this._matDiffuseColor);
                }

                if (uniPbrMetalness)
                    if (this._matPbrMetalness != null)
                    {
                        this._matPbrMetalnessOrig = uniPbrMetalness.getValue();
                        uniPbrMetalness.setValue(this._matPbrMetalness);
                    }
                    else
                        uniPbrMetalness.setValue(0);

                if (uniPbrRoughness)
                    if (this._matPbrRoughness != null)
                    {
                        this._matPbrRoughnessOrig = uniPbrRoughness.getValue();
                        uniPbrRoughness.setValue(this._matPbrRoughness);
                    }
                    else
                    {
                        uniPbrRoughness.setValue(0);
                    }
            }

            if (this.morphTargetsRenderMod) this.morphTargetsRenderMod.renderStart(cgl, 0);
            if (this.mesh)
            {
                this.mesh.render(cgl.getShader(), ignoreMaterial);
            }
            if (this.morphTargetsRenderMod) this.morphTargetsRenderMod.renderFinish(cgl);

            if (inUseMatProps.get())
            {
                if (uniDiff && this._matDiffuseColor) uniDiff.setValue(this._matDiffuseColorOrig);
                if (uniPbrMetalness && this._matPbrMetalnessOrig != undefined) uniPbrMetalness.setValue(this._matPbrMetalnessOrig);
                if (uniPbrRoughness && this._matPbrRoughnessOrig != undefined) uniPbrRoughness.setValue(this._matPbrRoughnessOrig);
            }

            if (useMat) cgl.popShader();
        }
        else
        {
            console.log("no mesh......");
        }
    }
};
const gltfMeshGroup = class
{
    constructor(gltf, m)
    {
        this.bounds = new CABLES.CG.BoundingBox();
        this.meshes = [];

        m.name = m.name || ("unknown mesh " + CABLES.simpleId());

        this.name = m.name;
        const prims = m.primitives;

        for (let i = 0; i < prims.length; i++)
        {
            const mesh = new gltfMesh(this.name, prims[i], gltf,
                (mesh) =>
                {
                    mesh.extras = m.extras;
                    this.bounds.apply(mesh.bounds);
                });

            mesh.submeshIndex = i;
            this.meshes.push(mesh);
        }
    }

    render(cgl, ignoreMat, skinRenderer, _time, weights)
    {
        for (let i = 0; i < this.meshes.length; i++)
        {
            const useMat = gltf.shaders[this.meshes[i].material];

            if (!ignoreMat && useMat) cgl.pushShader(gltf.shaders[this.meshes[i].material]);
            if (skinRenderer)skinRenderer.renderStart(cgl, _time);
            if (weights) this.meshes[i].weights = weights;
            this.meshes[i].render(cgl, ignoreMat, skinRenderer, _time);
            if (skinRenderer)skinRenderer.renderFinish(cgl);
            if (!ignoreMat && useMat) cgl.popShader();
        }
    }
};
const gltfNode = class
{
    constructor(node, gltf)
    {
        this.isChild = node.isChild || false;
        node.name = node.name || "unknown node " + CABLES.simpleId();
        this.name = node.name;
        if (node.hasOwnProperty("camera")) this.camera = node.camera;
        this.hidden = false;
        this.mat = mat4.create();
        this._animActions = {};
        this.animWeights = [];
        this._animMat = mat4.create();
        this._tempMat = mat4.create();
        this._tempQuat = quat.create();
        this._tempRotmat = mat4.create();
        this.mesh = null;
        this.children = [];
        this._node = node;
        this._gltf = gltf;
        this.absMat = mat4.create();
        this.addTranslate = null;
        this._tempAnimScale = null;
        this.addMulMat = null;
        this.updateMatrix();
        this.skinRenderer = null;
        this.copies = [];
    }

    get skin()
    {
        if (this._node.hasOwnProperty("skin")) return this._node.skin;
        else return -1;
    }

    copy()
    {
        this.isCopy = true;
        const n = new gltfNode(this._node, this._gltf);
        n.copyOf = this;

        n._animActions = this._animActions;
        n.children = this.children;
        if (this.skin) n.skinRenderer = new GltfSkin(this);

        this.updateMatrix();
        return n;
    }

    hasSkin()
    {
        if (this._node.hasOwnProperty("skin")) return this._gltf.json.skins[this._node.skin].name || "unknown";
        return false;
    }

    initSkin()
    {
        if (this.skin > -1)
        {
            this.skinRenderer = new GltfSkin(this);
        }
    }

    updateMatrix()
    {
        mat4.identity(this.mat);
        if (this._node.translation) mat4.translate(this.mat, this.mat, this._node.translation);

        if (this._node.rotation)
        {
            const rotmat = mat4.create();
            this._rot = this._node.rotation;

            mat4.fromQuat(rotmat, this._node.rotation);
            mat4.mul(this.mat, this.mat, rotmat);
        }

        if (this._node.scale)
        {
            this._scale = this._node.scale;
            mat4.scale(this.mat, this.mat, this._scale);
        }

        if (this._node.hasOwnProperty("mesh"))
        {
            this.mesh = this._gltf.meshes[this._node.mesh];
            if (this.isCopy)
            {
            }
        }

        if (this._node.children)
        {
            for (let i = 0; i < this._node.children.length; i++)
            {
                this._gltf.json.nodes[i].isChild = true;
                if (this._gltf.nodes[this._node.children[i]]) this._gltf.nodes[this._node.children[i]].isChild = true;
                this.children.push(this._node.children[i]);
            }
        }
    }

    unHide()
    {
        this.hidden = false;
        for (let i = 0; i < this.children.length; i++)
            if (this.children[i].unHide) this.children[i].unHide();
    }

    calcBounds(gltf, mat, bounds)
    {
        const localMat = mat4.create();

        if (mat) mat4.copy(localMat, mat);
        if (this.mat) mat4.mul(localMat, localMat, this.mat);

        if (this.mesh)
        {
            const bb = this.mesh.bounds.copy();
            bb.mulMat4(localMat);
            bounds.apply(bb);

            if (bounds.changed)
            {
                boundingPoints.push(
                    bb._min[0] || 0, bb._min[1] || 0, bb._min[2] || 0,
                    bb._max[0] || 0, bb._max[1] || 0, bb._max[2] || 0);
            }
        }

        for (let i = 0; i < this.children.length; i++)
        {
            if (gltf.nodes[this.children[i]] && gltf.nodes[this.children[i]].calcBounds)
            {
                const b = gltf.nodes[this.children[i]].calcBounds(gltf, localMat, bounds);

                bounds.apply(b);
            }
        }

        if (bounds.changed) return bounds;
        else return null;
    }

    setAnimAction(name)
    {
        if (!name) return;

        this._currentAnimaction = name;

        if (name && !this._animActions[name]) return null;

        for (let path in this._animActions[name])
        {
            if (path == "translation") this._animTrans = this._animActions[name][path];
            else if (path == "rotation") this._animRot = this._animActions[name][path];
            else if (path == "scale") this._animScale = this._animActions[name][path];
            else if (path == "weights") this.animWeights = this._animActions[name][path];
        }
    }

    setAnim(path, name, anims)
    {
        if (!path || !name || !anims) return;

        this._animActions[name] = this._animActions[name] || {};

        // debugger;

        // for (let i = 0; i < this.copies.length; i++) this.copies[i]._animActions = this._animActions;

        if (this._animActions[name][path]) op.log("[gltfNode] animation action path already exists", name, path, this._animActions[name][path]);

        this._animActions[name][path] = anims;

        if (path == "translation") this._animTrans = anims;
        else if (path == "rotation") this._animRot = anims;
        else if (path == "scale") this._animScale = anims;
        else if (path == "weights") this.animWeights = this._animActions[name][path];
    }

    modelMatLocal()
    {
        return this._animMat || this.mat;
    }

    modelMatAbs()
    {
        return this.absMat;
    }

    transform(cgl, _time)
    {
        if (!_time && _time != 0)_time = time;

        this._lastTimeTrans = _time;

        gltfTransforms++;

        if (!this._animTrans && !this._animRot && !this._animScale)
        {
            mat4.mul(cgl.mMatrix, cgl.mMatrix, this.mat);
            this._animMat = null;
        }
        else
        {
            this._animMat = this._animMat || mat4.create();
            mat4.identity(this._animMat);

            const playAnims = true;

            if (playAnims && this._animTrans)
            {
                mat4.translate(this._animMat, this._animMat, [
                    this._animTrans[0].getValue(_time),
                    this._animTrans[1].getValue(_time),
                    this._animTrans[2].getValue(_time)]);
            }
            else
            if (this._node.translation) mat4.translate(this._animMat, this._animMat, this._node.translation);

            if (playAnims && this._animRot)
            {
                if (this._animRot[0].defaultEasing == CABLES.EASING_LINEAR) CABLES.Anim.slerpQuaternion(_time, this._tempQuat, this._animRot[0], this._animRot[1], this._animRot[2], this._animRot[3]);
                else if (this._animRot[0].defaultEasing == CABLES.EASING_ABSOLUTE)
                {
                    this._tempQuat[0] = this._animRot[0].getValue(_time);
                    this._tempQuat[1] = this._animRot[1].getValue(_time);
                    this._tempQuat[2] = this._animRot[2].getValue(_time);
                    this._tempQuat[3] = this._animRot[3].getValue(_time);
                }
                else if (this._animRot[0].defaultEasing == CABLES.EASING_CUBICSPLINE)
                {
                    CABLES.Anim.slerpQuaternion(_time, this._tempQuat, this._animRot[0], this._animRot[1], this._animRot[2], this._animRot[3]);
                }

                mat4.fromQuat(this._tempMat, this._tempQuat);
                mat4.mul(this._animMat, this._animMat, this._tempMat);
            }
            else if (this._rot)
            {
                mat4.fromQuat(this._tempRotmat, this._rot);
                mat4.mul(this._animMat, this._animMat, this._tempRotmat);
            }

            if (playAnims && this._animScale)
            {
                if (!this._tempAnimScale) this._tempAnimScale = [1, 1, 1];
                this._tempAnimScale[0] = this._animScale[0].getValue(_time);
                this._tempAnimScale[1] = this._animScale[1].getValue(_time);
                this._tempAnimScale[2] = this._animScale[2].getValue(_time);
                mat4.scale(this._animMat, this._animMat, this._tempAnimScale);
            }
            else if (this._scale) mat4.scale(this._animMat, this._animMat, this._scale);

            mat4.mul(cgl.mMatrix, cgl.mMatrix, this._animMat);
        }

        if (this.animWeights)
        {
            this.weights = this.weights || [];

            let str = "";
            for (let i = 0; i < this.animWeights.length; i++)
            {
                this.weights[i] = this.animWeights[i].getValue(_time);
                str += this.weights[i] + "/";
            }

            // this.mesh.weights=this.animWeights.get(_time);
        }

        if (this.addTranslate) mat4.translate(cgl.mMatrix, cgl.mMatrix, this.addTranslate);

        if (this.addMulMat) mat4.mul(cgl.mMatrix, cgl.mMatrix, this.addMulMat);

        mat4.copy(this.absMat, cgl.mMatrix);
    }

    render(cgl, dontTransform, dontDrawMesh, ignoreMaterial, ignoreChilds, drawHidden, _time)
    {
        if (!dontTransform) cgl.pushModelMatrix();

        if (_time === undefined) _time = gltf.time;

        if (!dontTransform || this.skinRenderer) this.transform(cgl, _time);

        if (this.hidden && !drawHidden)
        {
        }
        else
        {
            if (this.skinRenderer)
            {
                this.skinRenderer.time = _time;
                if (!dontDrawMesh)
                    this.mesh.render(cgl, ignoreMaterial, this.skinRenderer, _time, this.weights);
            }
            else
            {
                if (this.mesh && !dontDrawMesh)
                    this.mesh.render(cgl, ignoreMaterial, null, _time, this.weights);
            }
        }

        if (!ignoreChilds && !this.hidden)
            for (let i = 0; i < this.children.length; i++)
                if (gltf.nodes[this.children[i]])
                    gltf.nodes[this.children[i]].render(cgl, dontTransform, dontDrawMesh, ignoreMaterial, ignoreChilds, drawHidden, _time);

        if (!dontTransform)cgl.popModelMatrix();
    }
};
let tab = null;

function closeTab()
{
    if (tab)gui.mainTabs.closeTab(tab.id);
    tab = null;
}

function formatVec(arr)
{
    const nums = [];
    for (let i = 0; i < arr.length; i++)
    {
        nums.push(Math.round(arr[i] * 1000) / 1000);
    }

    return nums.join(",");
}

function printNode(html, node, level)
{
    if (!gltf) return;

    html += "<tr class=\"row\">";

    let ident = "";
    let identSpace = "";

    for (let i = 1; i < level; i++)
    {
        identSpace += "&nbsp;&nbsp;&nbsp;";
        let identClass = "identBg";
        if (i == 1)identClass = "identBgLevel0";
        ident += "<td class=\"ident " + identClass + "\" ><div style=\"\"></div></td>";
    }
    let id = CABLES.uuid();
    html += ident;
    html += "<td colspan=\"" + (21 - level) + "\">";

    if (node.mesh && node.mesh.meshes.length)html += "<span class=\"icon icon-cube\"></span>&nbsp;";
    else html += "<span class=\"icon icon-box-select\"></span> &nbsp;";

    html += node.name + "</td><td></td>";

    if (node.mesh)
    {
        html += "<td>";
        for (let i = 0; i < node.mesh.meshes.length; i++)
        {
            if (i > 0)html += ", ";
            html += node.mesh.meshes[i].name;
        }

        html += "</td>";

        html += "<td>";
        html += node.hasSkin() || "-";
        html += "</td>";

        html += "<td>";
        let countMats = 0;
        for (let i = 0; i < node.mesh.meshes.length; i++)
        {
            if (countMats > 0)html += ", ";
            if (gltf.json.materials && node.mesh.meshes[i].hasOwnProperty("material"))
            {
                if (gltf.json.materials[node.mesh.meshes[i].material])
                {
                    html += gltf.json.materials[node.mesh.meshes[i].material].name;
                    countMats++;
                }
            }
        }
        if (countMats == 0)html += "none";
        html += "</td>";
    }
    else
    {
        html += "<td>-</td><td>-</td><td>-</td>";
    }

    html += "<td>";

    if (node._node.translation || node._node.rotation || node._node.scale)
    {
        let info = "";

        if (node._node.translation)info += "Translate: `" + formatVec(node._node.translation) + "` || ";
        if (node._node.rotation)info += "Rotation: `" + formatVec(node._node.rotation) + "` || ";
        if (node._node.scale)info += "Scale: `" + formatVec(node._node.scale) + "` || ";

        html += "<span class=\"icon icon-gizmo info\" data-info=\"" + info + "\"></span> &nbsp;";
    }

    if (node._animRot || node._animScale || node._animTrans)
    {
        let info = "Animated: ";
        if (node._animRot) info += "Rot ";
        if (node._animScale) info += "Scale ";
        if (node._animTrans) info += "Trans ";

        html += "<span class=\"icon icon-clock info\" data-info=\"" + info + "\"></span>&nbsp;";
    }

    if (!node._node.translation && !node._node.rotation && !node._node.scale && !node._animRot && !node._animScale && !node._animTrans) html += "-";

    html += "</td>";

    html += "<td>";
    let hideclass = "";
    if (node.hidden)hideclass = "node-hidden";

    // html+='';
    html += "<a onclick=\"gui.corePatch().getOpById('" + op.id + "').exposeNode('" + node.name + "','transform')\" class=\"treebutton\">Transform</a>";
    html += " <a onclick=\"gui.corePatch().getOpById('" + op.id + "').exposeNode('" + node.name + "','hierarchy')\" class=\"treebutton\">Hierarchy</a>";
    html += " <a onclick=\"gui.corePatch().getOpById('" + op.id + "').exposeNode('" + node.name + "')\" class=\"treebutton\">Node</a>";

    if (node.hasSkin())
        html += " <a onclick=\"gui.corePatch().getOpById('" + op.id + "').exposeNode('" + node.name + "',false,{skin:true});\" class=\"treebutton\">Skin</a>";

    html += "</td><td>";
    html += "&nbsp;<span class=\"icon iconhover icon-eye " + hideclass + "\" onclick=\"gui.corePatch().getOpById('" + op.id + "').toggleNodeVisibility('" + node.name + "');this.classList.toggle('node-hidden');\"></span>";
    html += "</td>";

    html += "</tr>";

    if (node.children)
    {
        for (let i = 0; i < node.children.length; i++)
            html = printNode(html, gltf.nodes[node.children[i]], level + 1);
    }

    return html;
}

function printMaterial(mat, idx)
{
    let html = "<tr>";
    html += " <td>" + idx + "</td>";
    html += " <td>" + mat.name + "</td>";

    html += " <td>";

    const info = JSON.stringify(mat, null, 4).replaceAll("\"", "").replaceAll("\n", "<br/>");

    html += "<span class=\"icon icon-info\" onclick=\"new CABLES.UI.ModalDialog({ 'html': '<pre>" + info + "</pre>', 'title': '" + mat.name + "' });\"></span>&nbsp;";

    if (mat.pbrMetallicRoughness && mat.pbrMetallicRoughness.baseColorFactor)
    {
        let rgb = "";
        rgb += "" + Math.round(mat.pbrMetallicRoughness.baseColorFactor[0] * 255);
        rgb += "," + Math.round(mat.pbrMetallicRoughness.baseColorFactor[1] * 255);
        rgb += "," + Math.round(mat.pbrMetallicRoughness.baseColorFactor[2] * 255);

        html += "<div style=\"width:15px;height:15px;background-color:rgb(" + rgb + ");display:inline-block\">&nbsp;</a>";
    }
    html += " <td style=\"\">" + (gltf.shaders[idx] ? "-" : "<a onclick=\"gui.corePatch().getOpById('" + op.id + "').assignMaterial('" + mat.name + "')\" class=\"treebutton\">Assign</a>") + "<td>";
    html += "<td>";

    html += "</tr>";
    return html;
}

function printInfo()
{
    if (!gltf) return;

    const startTime = performance.now();
    const sizes = {};
    let html = "<div style=\"overflow:scroll;width:100%;height:100%\">";

    html += "File: <a href=\"" + CABLES.platform.getCablesUrl() + "/asset/patches/?filename=" + inFile.get() + "\" target=\"_blank\">" + CABLES.basename(inFile.get()) + "</a><br/>";

    html += "Generator:" + gltf.json.asset.generator;

    let numNodes = 0;
    if (gltf.json.nodes)numNodes = gltf.json.nodes.length;
    html += "<div id=\"groupNodes\">Nodes (" + numNodes + ")</div>";

    html += "<table id=\"sectionNodes\" class=\"table treetable\">";

    html += "<tr>";
    html += " <th colspan=\"21\">Name</th>";
    html += " <th>Mesh</th>";
    html += " <th>Skin</th>";
    html += " <th>Material</th>";
    html += " <th>Transform</th>";
    html += " <th>Expose</th>";
    html += " <th></th>";
    html += "</tr>";

    for (let i = 0; i < gltf.nodes.length; i++)
    {
        if (!gltf.nodes[i].isChild)
            html = printNode(html, gltf.nodes[i], 1);
    }
    html += "</table>";

    // / //////////////////

    let numMaterials = 0;
    if (gltf.json.materials)numMaterials = gltf.json.materials.length;
    html += "<div id=\"groupMaterials\">Materials (" + numMaterials + ")</div>";

    if (!gltf.json.materials || gltf.json.materials.length == 0)
    {
    }
    else
    {
        html += "<table id=\"materialtable\"  class=\"table treetable\">";
        html += "<tr>";
        html += " <th>Index</th>";
        html += " <th>Name</th>";
        html += " <th>Color</th>";
        html += " <th>Function</th>";
        html += " <th></th>";
        html += "</tr>";
        for (let i = 0; i < gltf.json.materials.length; i++)
        {
            html += printMaterial(gltf.json.materials[i], i);
        }
        html += "</table>";
    }

    // / ///////////////////////

    html += "<div id=\"groupMeshes\">Meshes (" + gltf.json.meshes.length + ")</div>";

    html += "<table id=\"meshestable\"  class=\"table treetable\">";
    html += "<tr>";
    html += " <th>Name</th>";
    html += " <th>Node</th>";
    html += " <th>Material</th>";
    html += " <th>Vertices</th>";
    html += " <th>Attributes</th>";
    html += "</tr>";

    let sizeBufferViews = [];
    sizes.meshes = 0;
    sizes.meshTargets = 0;

    for (let i = 0; i < gltf.json.meshes.length; i++)
    {
        html += "<tr>";
        html += "<td>" + gltf.json.meshes[i].name + "</td>";

        html += "<td>";
        let count = 0;
        let nodename = "";
        if (gltf.json.nodes)
            for (let j = 0; j < gltf.json.nodes.length; j++)
            {
                if (gltf.json.nodes[j].mesh == i)
                {
                    count++;
                    if (count == 1)
                    {
                        nodename = gltf.json.nodes[j].name;
                    }
                }
            }
        if (count > 1) html += (count) + " nodes (" + nodename + " ...)";
        else html += nodename;
        html += "</td>";

        // -------

        html += "<td>";
        for (let j = 0; j < gltf.json.meshes[i].primitives.length; j++)
        {
            if (gltf.json.meshes[i].primitives[j].hasOwnProperty("material"))
            {
                if (gltf.json.materials[gltf.json.meshes[i]])
                {
                    html += gltf.json.materials[gltf.json.meshes[i].primitives[j].material].name + " ";
                }
            }
            else html += "None";
        }
        html += "</td>";

        html += "<td>";
        let numVerts = 0;
        for (let j = 0; j < gltf.json.meshes[i].primitives.length; j++)
        {
            if (gltf.json.meshes[i].primitives[j].attributes.POSITION != undefined)
            {
                let v = parseInt(gltf.json.accessors[gltf.json.meshes[i].primitives[j].attributes.POSITION].count);
                numVerts += v;
                html += "" + v + "<br/>";
            }
            else html += "-<br/>";
        }

        if (gltf.json.meshes[i].primitives.length > 1)
            html += "=" + numVerts;
        html += "</td>";

        html += "<td>";
        for (let j = 0; j < gltf.json.meshes[i].primitives.length; j++)
        {
            html += Object.keys(gltf.json.meshes[i].primitives[j].attributes);
            html += " <a onclick=\"gui.corePatch().getOpById('" + op.id + "').exposeGeom('" + gltf.json.meshes[i].name + "'," + j + ")\" class=\"treebutton\">Geometry</a>";
            html += "<br/>";

            if (gltf.json.meshes[i].primitives[j].targets)
            {
                html += gltf.json.meshes[i].primitives[j].targets.length + " targets<br/>";

                if (gltf.json.meshes[i].extras && gltf.json.meshes[i].extras.targetNames)
                    html += "Targetnames:<br/>" + gltf.json.meshes[i].extras.targetNames.join("<br/>");

                html += "<br/>";
            }
        }

        html += "</td>";
        html += "</tr>";

        for (let j = 0; j < gltf.json.meshes[i].primitives.length; j++)
        {
            const accessor = gltf.json.accessors[gltf.json.meshes[i].primitives[j].indices];
            if (accessor)
            {
                let bufView = accessor.bufferView;

                if (sizeBufferViews.indexOf(bufView) == -1)
                {
                    sizeBufferViews.push(bufView);
                    if (gltf.json.bufferViews[bufView])sizes.meshes += gltf.json.bufferViews[bufView].byteLength;
                }
            }

            for (let k in gltf.json.meshes[i].primitives[j].attributes)
            {
                const attr = gltf.json.meshes[i].primitives[j].attributes[k];
                const bufView2 = gltf.json.accessors[attr].bufferView;

                if (sizeBufferViews.indexOf(bufView2) == -1)
                {
                    sizeBufferViews.push(bufView2);
                    if (gltf.json.bufferViews[bufView2])sizes.meshes += gltf.json.bufferViews[bufView2].byteLength;
                }
            }

            if (gltf.json.meshes[i].primitives[j].targets)
                for (let k = 0; k < gltf.json.meshes[i].primitives[j].targets.length; k++)
                {
                    for (let l in gltf.json.meshes[i].primitives[j].targets[k])
                    {
                        const accessorIdx = gltf.json.meshes[i].primitives[j].targets[k][l];
                        const accessor = gltf.json.accessors[accessorIdx];
                        const bufView2 = accessor.bufferView;
                        console.log("accessor", accessor);
                        if (sizeBufferViews.indexOf(bufView2) == -1)
                            if (gltf.json.bufferViews[bufView2])
                            {
                                sizeBufferViews.push(bufView2);
                                sizes.meshTargets += gltf.json.bufferViews[bufView2].byteLength;
                            }
                    }
                }
        }
    }
    html += "</table>";

    // / //////////////////////////////////

    let numSamplers = 0;
    let numAnims = 0;
    let numKeyframes = 0;

    if (gltf.json.animations)
    {
        numAnims = gltf.json.animations.length;
        for (let i = 0; i < gltf.json.animations.length; i++)
        {
            numSamplers += gltf.json.animations[i].samplers.length;
        }
    }

    html += "<div id=\"groupAnims\">Animations (" + numAnims + "/" + numSamplers + ")</div>";

    if (gltf.json.animations)
    {
        html += "<table id=\"sectionAnim\" class=\"table treetable\">";
        html += "<tr>";
        html += "  <th>Name</th>";
        html += "  <th>Target node</th>";
        html += "  <th>Path</th>";
        html += "  <th>Interpolation</th>";
        html += "  <th>Keys</th>";
        html += "</tr>";


        sizes.animations = 0;

        for (let i = 0; i < gltf.json.animations.length; i++)
        {
            for (let j = 0; j < gltf.json.animations[i].samplers.length; j++)
            {
                let bufView = gltf.json.accessors[gltf.json.animations[i].samplers[j].input].bufferView;
                if (sizeBufferViews.indexOf(bufView) == -1)
                {
                    sizeBufferViews.push(bufView);
                    sizes.animations += gltf.json.bufferViews[bufView].byteLength;
                }

                bufView = gltf.json.accessors[gltf.json.animations[i].samplers[j].output].bufferView;
                if (sizeBufferViews.indexOf(bufView) == -1)
                {
                    sizeBufferViews.push(bufView);
                    sizes.animations += gltf.json.bufferViews[bufView].byteLength;
                }
            }

            for (let j = 0; j < gltf.json.animations[i].channels.length; j++)
            {
                html += "<tr>";
                html += "  <td> Anim " + i + ": " + gltf.json.animations[i].name + "</td>";

                html += "  <td>" + gltf.nodes[gltf.json.animations[i].channels[j].target.node].name + "</td>";
                html += "  <td>";
                html += gltf.json.animations[i].channels[j].target.path + " ";
                html += "  </td>";

                const smplidx = gltf.json.animations[i].channels[j].sampler;
                const smplr = gltf.json.animations[i].samplers[smplidx];

                html += "  <td>" + smplr.interpolation + "</td>";

                html += "  <td>" + gltf.json.accessors[smplr.output].count;
                numKeyframes += gltf.json.accessors[smplr.output].count;

                // html += "&nbsp;&nbsp;<a onclick=\"gui.corePatch().getOpById('" + op.id + "').showAnim('" + i + "','" + j + "')\" class=\"icon icon-search\"></a>";

                html += "</td>";

                html += "</tr>";
            }
        }

        html += "<tr>";
        html += "  <td></td>";
        html += "  <td></td>";
        html += "  <td></td>";
        html += "  <td></td>";
        html += "  <td>" + numKeyframes + " total</td>";
        html += "</tr>";
        html += "</table>";
    }
    else
    {

    }

    // / ///////////////////

    let numImages = 0;
    if (gltf.json.images)numImages = gltf.json.images.length;
    html += "<div id=\"groupImages\">Images (" + numImages + ")</div>";

    if (gltf.json.images)
    {
        html += "<table id=\"sectionImages\" class=\"table treetable\">";

        html += "<tr>";
        html += "  <th>name</th>";
        html += "  <th>type</th>";
        html += "  <th>func</th>";
        html += "</tr>";

        sizes.images = 0;

        for (let i = 0; i < gltf.json.images.length; i++)
        {
            if (gltf.json.images[i].hasOwnProperty("bufferView"))
            {
                // if (sizeBufferViews.indexOf(gltf.json.images[i].hasOwnProperty("bufferView")) == -1)console.log("image bufferview already there?!");
                // else
                sizes.images += gltf.json.bufferViews[gltf.json.images[i].bufferView].byteLength;
            }
            else console.log("image has no bufferview?!");

            html += "<tr>";
            html += "<td>" + gltf.json.images[i].name + "</td>";
            html += "<td>" + gltf.json.images[i].mimeType + "</td>";
            html += "<td>";

            let name = gltf.json.images[i].name;
            if (name === undefined)name = gltf.json.images[i].bufferView;

            html += "<a onclick=\"gui.corePatch().getOpById('" + op.id + "').exposeTexture('" + name + "')\" class=\"treebutton\">Expose</a>";
            html += "</td>";

            html += "<tr>";
        }
        html += "</table>";
    }

    // / ///////////////////////

    let numCameras = 0;
    if (gltf.json.cameras)numCameras = gltf.json.cameras.length;
    html += "<div id=\"groupCameras\">Cameras (" + numCameras + ")</div>";

    if (gltf.json.cameras)
    {
        html += "<table id=\"sectionCameras\" class=\"table treetable\">";

        html += "<tr>";
        html += "  <th>name</th>";
        html += "  <th>type</th>";
        html += "  <th>info</th>";
        html += "</tr>";

        for (let i = 0; i < gltf.json.cameras.length; i++)
        {
            html += "<tr>";
            html += "<td>" + gltf.json.cameras[i].name + "</td>";
            html += "<td>" + gltf.json.cameras[i].type + "</td>";
            html += "<td>";

            if (gltf.json.cameras[i].perspective)
            {
                html += "yfov: " + Math.round(gltf.json.cameras[i].perspective.yfov * 100) / 100;
                html += ", ";
                html += "zfar: " + Math.round(gltf.json.cameras[i].perspective.zfar * 100) / 100;
                html += ", ";
                html += "znear: " + Math.round(gltf.json.cameras[i].perspective.znear * 100) / 100;
            }
            html += "</td>";

            html += "<tr>";
        }
        html += "</table>";
    }

    // / ////////////////////////////////////

    let numSkins = 0;
    if (gltf.json.skins)numSkins = gltf.json.skins.length;
    html += "<div id=\"groupSkins\">Skins (" + numSkins + ")</div>";

    if (gltf.json.skins)
    {
        // html += "<h3>Skins (" + gltf.json.skins.length + ")</h3>";
        html += "<table id=\"sectionSkins\" class=\"table treetable\">";

        html += "<tr>";
        html += "  <th>name</th>";
        html += "  <th></th>";
        html += "  <th>total joints</th>";
        html += "</tr>";

        for (let i = 0; i < gltf.json.skins.length; i++)
        {
            html += "<tr>";
            html += "<td>" + gltf.json.skins[i].name + "</td>";
            html += "<td>" + "</td>";
            html += "<td>" + gltf.json.skins[i].joints.length + "</td>";
            html += "<td>";
            html += "</td>";
            html += "<tr>";
        }
        html += "</table>";
    }

    // / ////////////////////////////////////

    if (gltf.timing)
    {
        html += "<div id=\"groupTiming\">Debug Loading Timing </div>";

        html += "<table id=\"sectionTiming\" class=\"table treetable\">";

        html += "<tr>";
        html += "  <th>task</th>";
        html += "  <th>time used</th>";
        html += "</tr>";

        let lt = 0;
        for (let i = 0; i < gltf.timing.length - 1; i++)
        {
            html += "<tr>";
            html += "  <td>" + gltf.timing[i][0] + "</td>";
            html += "  <td>" + (gltf.timing[i + 1][1] - gltf.timing[i][1]) + " ms</td>";
            html += "</tr>";
            // lt = gltf.timing[i][1];
        }
        html += "</table>";
    }

    // / //////////////////////////

    let sizeBin = 0;
    if (gltf.json.buffers)
        sizeBin = gltf.json.buffers[0].byteLength;

    html += "<div id=\"groupBinary\">File Size Allocation (" + Math.round(sizeBin / 1024) + "k )</div>";

    html += "<table id=\"sectionBinary\" class=\"table treetable\">";
    html += "<tr>";
    html += "  <th>name</th>";
    html += "  <th>size</th>";
    html += "  <th>%</th>";
    html += "</tr>";
    let sizeUnknown = sizeBin;
    for (let i in sizes)
    {
        // html+=i+':'+Math.round(sizes[i]/1024);
        html += "<tr>";
        html += "<td>" + i + "</td>";
        html += "<td>" + readableSize(sizes[i]) + " </td>";
        html += "<td>" + Math.round(sizes[i] / sizeBin * 100) + "% </td>";
        html += "<tr>";
        sizeUnknown -= sizes[i];
    }

    if (sizeUnknown != 0)
    {
        html += "<tr>";
        html += "<td>unknown</td>";
        html += "<td>" + readableSize(sizeUnknown) + " </td>";
        html += "<td>" + Math.round(sizeUnknown / sizeBin * 100) + "% </td>";
        html += "<tr>";
    }

    html += "</table>";
    html += "</div>";

    tab = new CABLES.UI.Tab("GLTF " + CABLES.basename(inFile.get()), { "icon": "cube", "infotext": "tab_gltf", "padding": true, "singleton": true });
    gui.mainTabs.addTab(tab, true);

    tab.addEventListener("close", closeTab);
    tab.html(html);

    CABLES.UI.Collapsable.setup(ele.byId("groupNodes"), ele.byId("sectionNodes"), false);
    CABLES.UI.Collapsable.setup(ele.byId("groupMaterials"), ele.byId("materialtable"), true);
    CABLES.UI.Collapsable.setup(ele.byId("groupAnims"), ele.byId("sectionAnim"), true);
    CABLES.UI.Collapsable.setup(ele.byId("groupMeshes"), ele.byId("meshestable"), true);
    CABLES.UI.Collapsable.setup(ele.byId("groupCameras"), ele.byId("sectionCameras"), true);
    CABLES.UI.Collapsable.setup(ele.byId("groupImages"), ele.byId("sectionImages"), true);
    CABLES.UI.Collapsable.setup(ele.byId("groupSkins"), ele.byId("sectionSkins"), true);
    CABLES.UI.Collapsable.setup(ele.byId("groupBinary"), ele.byId("sectionBinary"), true);
    CABLES.UI.Collapsable.setup(ele.byId("groupTiming"), ele.byId("sectionTiming"), true);

    gui.maintabPanel.show(true);
}

function readableSize(n)
{
    if (n > 1024) return Math.round(n / 1024) + " kb";
    if (n > 1024 * 500) return Math.round(n / 1024) + " mb";
    else return n + " bytes";
}
const GltfSkin = class
{
    constructor(node)
    {
        this._mod = null;
        this._node = node;
        this._lastTime = 0;
        this._matArr = [];
        this._m = mat4.create();
        this._invBindMatrix = mat4.create();
        this.identity = true;
    }

    renderFinish(cgl)
    {
        cgl.popModelMatrix();
        this._mod.unbind();
    }

    renderStart(cgl, time)
    {
        if (!this._mod)
        {
            this._mod = new CGL.ShaderModifier(cgl, op.name + this._node.name);

            this._mod.addModule({
                "priority": -2,
                "name": "MODULE_VERTEX_POSITION",
                "srcHeadVert": attachments.skin_head_vert || "",
                "srcBodyVert": attachments.skin_vert || ""
            });

            this._mod.addUniformVert("m4[]", "MOD_boneMats", []);// bohnenmatze
            const tr = vec3.create();
        }

        const skinIdx = this._node.skin;
        const arrLength = gltf.json.skins[skinIdx].joints.length * 16;

        // if (this._lastTime != time || !time)
        {
            // this._lastTime=inTime.get();
            if (this._matArr.length != arrLength) this._matArr.length = arrLength;

            for (let i = 0; i < gltf.json.skins[skinIdx].joints.length; i++)
            {
                const i16 = i * 16;
                const jointIdx = gltf.json.skins[skinIdx].joints[i];
                const nodeJoint = gltf.nodes[jointIdx];

                for (let j = 0; j < 16; j++)
                    this._invBindMatrix[j] = gltf.accBuffers[gltf.json.skins[skinIdx].inverseBindMatrices][i16 + j];

                mat4.mul(this._m, nodeJoint.modelMatAbs(), this._invBindMatrix);

                for (let j = 0; j < this._m.length; j++) this._matArr[i16 + j] = this._m[j];
            }

            this._mod.setUniformValue("MOD_boneMats", this._matArr);
            this._lastTime = time;
        }

        this._mod.define("SKIN_NUM_BONES", gltf.json.skins[skinIdx].joints.length);
        this._mod.bind();

        // draw mesh...
        cgl.pushModelMatrix();
        if (this.identity)mat4.identity(cgl.mMatrix);
    }
};
const GltfTargetsRenderer = class
{
    constructor(mesh)
    {
        this.mesh = mesh;
        this.tex = null;
        this.numRowsPerTarget = 0;

        this.makeTex(mesh.geom);
    }

    renderFinish(cgl)
    {
        if (!cgl.gl) return;
        cgl.popModelMatrix();
        this._mod.unbind();
    }

    renderStart(cgl, time)
    {
        if (!cgl.gl) return;
        if (!this._mod)
        {
            this._mod = new CGL.ShaderModifier(cgl, "gltftarget");

            this._mod.addModule({
                "priority": -2,
                "name": "MODULE_VERTEX_POSITION",
                "srcHeadVert": attachments.targets_head_vert || "",
                "srcBodyVert": attachments.targets_vert || ""
            });

            this._mod.addUniformVert("4f", "MOD_targetTexInfo", [0, 0, 0, 0]);
            this._mod.addUniformVert("t", "MOD_targetTex", 1);
            this._mod.addUniformVert("f[]", "MOD_weights", []);

            const tr = vec3.create();
        }

        this._mod.pushTexture("MOD_targetTex", this.tex);
        if (this.tex && this.mesh.weights)
        {
            this._mod.setUniformValue("MOD_weights", this.mesh.weights);
            this._mod.setUniformValue("MOD_targetTexInfo", [this.tex.width, this.tex.height, this.numRowsPerTarget, this.mesh.weights.length]);

            this._mod.define("MOD_NUM_WEIGHTS", Math.max(1, this.mesh.weights.length));
        }
        else
        {
            this._mod.define("MOD_NUM_WEIGHTS", 1);
        }
        this._mod.bind();

        // draw mesh...
        cgl.pushModelMatrix();
        if (this.identity)mat4.identity(cgl.mMatrix);
    }

    makeTex(geom)
    {
        if (!cgl.gl) return;

        if (!geom.morphTargets || !geom.morphTargets.length) return;

        let w = geom.morphTargets[0].vertices.length / 3;
        let h = 0;
        this.numRowsPerTarget = 0;

        if (geom.morphTargets[0].vertices && geom.morphTargets[0].vertices.length) this.numRowsPerTarget++;
        if (geom.morphTargets[0].vertexNormals && geom.morphTargets[0].vertexNormals.length) this.numRowsPerTarget++;
        if (geom.morphTargets[0].tangents && geom.morphTargets[0].tangents.length) this.numRowsPerTarget++;
        if (geom.morphTargets[0].bitangents && geom.morphTargets[0].bitangents.length) this.numRowsPerTarget++;

        h = geom.morphTargets.length * this.numRowsPerTarget;

        // console.log("this.numRowsPerTarget", this.numRowsPerTarget);

        const pixels = new Float32Array(w * h * 4);
        let row = 0;

        for (let i = 0; i < geom.morphTargets.length; i++)
        {
            if (geom.morphTargets[i].vertices && geom.morphTargets[i].vertices.length)
            {
                for (let j = 0; j < geom.morphTargets[i].vertices.length; j += 3)
                {
                    pixels[((row * w) + (j / 3)) * 4 + 0] = geom.morphTargets[i].vertices[j + 0];
                    pixels[((row * w) + (j / 3)) * 4 + 1] = geom.morphTargets[i].vertices[j + 1];
                    pixels[((row * w) + (j / 3)) * 4 + 2] = geom.morphTargets[i].vertices[j + 2];
                    pixels[((row * w) + (j / 3)) * 4 + 3] = 1;
                }
                row++;
            }

            if (geom.morphTargets[i].vertexNormals && geom.morphTargets[i].vertexNormals.length)
            {
                for (let j = 0; j < geom.morphTargets[i].vertexNormals.length; j += 3)
                {
                    pixels[(row * w + j / 3) * 4 + 0] = geom.morphTargets[i].vertexNormals[j + 0];
                    pixels[(row * w + j / 3) * 4 + 1] = geom.morphTargets[i].vertexNormals[j + 1];
                    pixels[(row * w + j / 3) * 4 + 2] = geom.morphTargets[i].vertexNormals[j + 2];
                    pixels[(row * w + j / 3) * 4 + 3] = 1;
                }

                row++;
            }

            if (geom.morphTargets[i].tangents && geom.morphTargets[i].tangents.length)
            {
                for (let j = 0; j < geom.morphTargets[i].tangents.length; j += 3)
                {
                    pixels[(row * w + j / 3) * 4 + 0] = geom.morphTargets[i].tangents[j + 0];
                    pixels[(row * w + j / 3) * 4 + 1] = geom.morphTargets[i].tangents[j + 1];
                    pixels[(row * w + j / 3) * 4 + 2] = geom.morphTargets[i].tangents[j + 2];
                    pixels[(row * w + j / 3) * 4 + 3] = 1;
                }
                row++;
            }

            if (geom.morphTargets[i].bitangents && geom.morphTargets[i].bitangents.length)
            {
                for (let j = 0; j < geom.morphTargets[i].bitangents.length; j += 3)
                {
                    pixels[(row * w + j / 3) * 4 + 0] = geom.morphTargets[i].bitangents[j + 0];
                    pixels[(row * w + j / 3) * 4 + 1] = geom.morphTargets[i].bitangents[j + 1];
                    pixels[(row * w + j / 3) * 4 + 2] = geom.morphTargets[i].bitangents[j + 2];
                    pixels[(row * w + j / 3) * 4 + 3] = 1;
                }
                row++;
            }
        }

        this.tex = new CGL.Texture(cgl, { "isFloatingPointTexture": true, "name": "targetsTexture" });

        this.tex.initFromData(pixels, w, h, CGL.Texture.FILTER_LINEAR, CGL.Texture.WRAP_REPEAT);

        // console.log("morphTargets generated texture", w, h);
    }
};
// https://raw.githubusercontent.com/KhronosGroup/glTF/master/specification/2.0/figures/gltfOverview-2.0.0b.png

const
    inExec = op.inTrigger("Render"),
    dataPort = op.inString("data"),
    inFile = op.inUrl("glb File", [".glb"]),
    inRender = op.inBool("Draw", true),
    inCamera = op.inDropDown("Camera", ["None"], "None"),
    inAnimation = op.inString("Animation", ""),
    inShow = op.inTriggerButton("Show Structure"),
    inCenter = op.inSwitch("Center", ["None", "XYZ", "XZ"], "XYZ"),
    inRescale = op.inBool("Rescale", true),
    inRescaleSize = op.inFloat("Rescale Size", 2.5),

    inTime = op.inFloat("Time"),
    inTimeLine = op.inBool("Sync to timeline", false),
    inLoop = op.inBool("Loop", true),

    inNormFormat = op.inSwitch("Normals Format", ["XYZ", "X-ZY"], "XYZ"),
    inVertFormat = op.inSwitch("Vertices Format", ["XYZ", "XZ-Y"], "XYZ"),
    inCalcNormals = op.inSwitch("Calc Normals", ["Auto", "Force Smooth", "Never"], "Auto"),

    inMaterials = op.inObject("Materials"),
    inHideNodes = op.inArray("Hide Nodes"),
    inUseMatProps = op.inBool("Use Material Properties", false),

    inActive = op.inBool("Active", true),

    nextBefore = op.outTrigger("Render Before"),
    next = op.outTrigger("Next"),
    outGenerator = op.outString("Generator"),

    outVersion = op.outNumber("GLTF Version"),
    outExtensions = op.outArray("GLTF Extensions Used"),
    outAnimLength = op.outNumber("Anim Length", 0),
    outAnimTime = op.outNumber("Anim Time", 0),
    outJson = op.outObject("Json"),
    outAnims = op.outArray("Anims"),
    outPoints = op.outArray("BoundingPoints"),
    outBounds = op.outObject("Bounds"),
    outAnimFinished = op.outTrigger("Finished"),
    outLoading = op.outBool("Loading");

op.setPortGroup("Timing", [inTime, inTimeLine, inLoop]);

let cgl = op.patch.cg || op.patch.cgl;
let gltfLoadingErrorMesh = null;
let gltfLoadingError = false;
let gltfTransforms = 0;
let finishedLoading = false;
let cam = null;
let boundingPoints = [];
let gltf = null;
let maxTime = 0;
let maxTimeDict = {};
let time = 0;
let needsMatUpdate = true;
let timedLoader = null;
let loadingId = null;
let data = null;
const scale = vec3.create();
let lastTime = 0;
let doCenter = false;
const boundsCenter = vec3.create();

inFile.onChange =
    inVertFormat.onChange =
    inCalcNormals.onChange =
    inNormFormat.onChange = reloadSoon;

inShow.onTriggered = printInfo;
dataPort.onChange = loadData;
inHideNodes.onChange = hideNodesFromData;
inAnimation.onChange = updateAnimation;
inCenter.onChange = updateCenter;
op.toWorkPortsNeedToBeLinked(inExec);

dataPort.setUiAttribs({ "hideParam": true, "hidePort": true });
op.setPortGroup("Transform", [inRescale, inRescaleSize, inCenter]);

function updateCamera()
{
    const arr = ["None"];
    if (gltf)
    {
        for (let i = 0; i < gltf.nodes.length; i++)
        {
            if (gltf.nodes[i].camera >= 0)
            {
                arr.push(gltf.nodes[i].name);
            }
        }
    }
    inCamera.uiAttribs.values = arr;
}

function updateCenter()
{
    doCenter = inCenter.get() != "None";

    if (gltf && gltf.bounds)
    {
        boundsCenter.set(gltf.bounds.center);
        boundsCenter[0] = -boundsCenter[0];
        boundsCenter[1] = -boundsCenter[1];
        boundsCenter[2] = -boundsCenter[2];
        if (inCenter.get() == "XZ") boundsCenter[1] = -gltf.bounds.minY;
    }
}

inRescale.onChange = function ()
{
    inRescaleSize.setUiAttribs({ "greyout": !inRescale.get() });
};

inMaterials.onChange = function ()
{
    needsMatUpdate = true;
};

op.onDelete = function ()
{
    closeTab();
};

inTimeLine.onChange = function ()
{
    inTime.setUiAttribs({ "greyout": inTimeLine.get() });
};

inCamera.onChange = setCam;

function setCam()
{
    cam = null;
    if (!gltf) return;

    for (let i = 0; i < gltf.nodes.length; i++)
    {
        if (gltf.nodes[i].name == inCamera.get())cam = new gltfCamera(gltf, gltf.nodes[i]);
    }
}

inExec.onTriggered = function ()
{
    cgl = op.patch.cg || op.patch.cgl;

    if (!finishedLoading) return;
    if (!inActive.get()) return;

    if (gltfLoadingError)
    {
        if (!gltfLoadingErrorMesh) gltfLoadingErrorMesh = CGL.MESHES.getSimpleCube(cgl, "ErrorCube");
        gltfLoadingErrorMesh.render(cgl.getShader());
    }

    gltfTransforms = 0;
    if (inTimeLine.get()) time = op.patch.timer.getTime();
    else time = Math.max(0, inTime.get());

    if (inLoop.get())
    {
        time %= maxTime;
        if (time < lastTime) outAnimFinished.trigger();
    }
    else
    {
        if (maxTime > 0 && time >= maxTime) outAnimFinished.trigger();
    }

    lastTime = time;

    cgl.pushModelMatrix();

    outAnimTime.set(time || 0);

    if (finishedLoading && gltf && gltf.bounds)
    {
        if (inRescale.get())
        {
            let sc = inRescaleSize.get() / gltf.bounds.maxAxis;
            gltf.scale = sc;
            vec3.set(scale, sc, sc, sc);
            mat4.scale(cgl.mMatrix, cgl.mMatrix, scale);
        }
        if (doCenter)
        {
            mat4.translate(cgl.mMatrix, cgl.mMatrix, boundsCenter);
        }
    }

    let oldScene = cgl.tempData.currentScene || null;
    cgl.tempData.currentScene = gltf;

    nextBefore.trigger();

    if (finishedLoading)
    {
        if (needsMatUpdate) updateMaterials();

        if (cam) cam.start(time);

        if (gltf)
        {
            gltf.time = time;

            if (gltf.bounds && cgl.shouldDrawHelpers(op))
            {
                if (op.isCurrentUiOp()) cgl.pushShader(CABLES.GL_MARKER.getSelectedShader(cgl));
                else cgl.pushShader(CABLES.GL_MARKER.getDefaultShader(cgl));

                gltf.bounds.render(cgl, null, op);
                cgl.popShader();
            }

            if (inRender.get())
            {
                for (let i = 0; i < gltf.nodes.length; i++)
                    if (!gltf.nodes[i].isChild)
                        gltf.nodes[i].render(cgl);
            }
            else
            {
                for (let i = 0; i < gltf.nodes.length; i++)
                    if (!gltf.nodes[i].isChild)
                        gltf.nodes[i].render(cgl, false, true);
            }
        }
    }

    next.trigger();
    cgl.tempData.currentScene = oldScene;

    cgl.popModelMatrix();

    if (cam)cam.end();
};

function finishLoading()
{
    if (!gltf)
    {
        finishedLoading = true;
        gltfLoadingError = true;
        cgl.patch.loading.finished(loadingId);

        op.setUiError("nogltf", "GLTF File not found");
        return;
    }

    op.setUiError("nogltf", null);

    if (gltf.loadingMeshes > 0)
    {
        // op.log("waiting for async meshes...");
        setTimeout(finishLoading, 100);
        return;
    }

    gltf.timing.push(["finishLoading()", Math.round((performance.now() - gltf.startTime))]);

    needsMatUpdate = true;
    // op.refreshParams();
    // outAnimLength.set(maxTime);

    gltf.bounds = new CABLES.CG.BoundingBox();
    // gltf.bounds.applyPos(0, 0, 0);

    // if (!gltf)op.setUiError("urlerror", "could not load gltf:<br/>\"" + inFile.get() + "\"", 2);
    // else op.setUiError("urlerror", null);

    gltf.timing.push(["start calc bounds", Math.round((performance.now() - gltf.startTime))]);

    for (let i = 0; i < gltf.nodes.length; i++)
    {
        const node = gltf.nodes[i];
        node.updateMatrix();
        if (!node.isChild) node.calcBounds(gltf, null, gltf.bounds);
    }

    if (gltf.bounds)outBounds.setRef(gltf.bounds);

    gltf.timing.push(["calced bounds", Math.round((performance.now() - gltf.startTime))]);

    hideNodesFromData();

    gltf.timing.push(["hideNodesFromData", Math.round((performance.now() - gltf.startTime))]);

    if (tab)printInfo();

    gltf.timing.push(["printinfo", Math.round((performance.now() - gltf.startTime))]);

    updateCamera();
    setCam();
    outPoints.set(boundingPoints);

    if (gltf)
    {
        if (inFile.get() && !inFile.get().startsWith("data:"))
        {
            op.setUiAttrib({ "extendTitle": CABLES.basename(inFile.get()) });
        }

        gltf.loaded = Date.now();
    }

    if (gltf)
    {
        for (let i = 0; i < gltf.nodes.length; i++)
        {
            if (!gltf.nodes[i].isChild)
            {
                gltf.nodes[i].render(cgl, false, true, true, false, true, 0);
            }
        }

        for (let i = 0; i < gltf.nodes.length; i++)
        {
            const node = gltf.nodes[i];
            node.children = CABLES.uniqueArray(node.children); // stupid fix why are there too many children ?!
        }
    }

    updateCenter();
    updateAnimation();

    outLoading.set(false);

    cgl.patch.loading.finished(loadingId);
    loadingId = null;

    // if (gltf.chunks.length > 1) gltf.chunks[1] = null;
    // if (gltf.chunks.length > 2) gltf.chunks[2] = null;

    // op.setUiAttrib({ "accBuffersDelete": CABLES.basename(inFile.get()) });

    if (gltf.accBuffersDelete)
    {
        for (let i = 0; i < gltf.accBuffersDelete.length; i++)
        {
            gltf.accBuffers[gltf.accBuffersDelete[i]] = null;
        }
    }

    // setTimeout(() =>
    // {
    //     for (let i = 0; i < gltf.nodes.length; i++)
    //     {
    //     // console.log(gltf.nodes[i]);

    //         if (gltf.nodes[i].mesh && gltf.nodes[i].mesh.meshes)
    //         {
    //         // console.log(gltf.nodes[i].mesh.meshes.length);
    //             for (let j = 0; j < gltf.nodes[i].mesh.meshes.length; j++)
    //             {
    //                 console.log(gltf.nodes[i].mesh.meshes[j]);

    //                 // for (let k = 0; k < gltf.nodes[i].mesh.meshes.length; k++)
    //                 {
    //                     if (gltf.nodes[i].mesh.meshes[j].mesh)
    //                     {
    //                         gltf.nodes[i].mesh.meshes[j].mesh.freeMem();
    //                         // console.log(gltf.nodes[i].mesh.meshes[j].mesh);
    //                         // for (let l = 0; l < gltf.nodes[i].mesh.meshes[j].mesh._attributes.length; l++)
    //                         //     gltf.nodes[i].mesh.meshes[j].mesh._attributes[l] = null;
    //                     }
    //                 }

    //                 gltf.nodes[i].mesh.meshes[j].geom.clear();
    //                 console.log("clear!");
    //             }
    //         }
    //     }
    // }, 1000);

    if (!(gltf.json.images && gltf.json.images.length)) gltf.chunks = null;

    finishedLoading = true;
}

function loadBin(addCacheBuster)
{
    if (!inActive.get()) return;

    if (!loadingId)loadingId = cgl.patch.loading.start("gltfScene", inFile.get(), op);

    let fileToLoad = inFile.get();

    if (!fileToLoad || fileToLoad == "null") return;
    let url = op.patch.getFilePath(String(inFile.get()));
    if (!url) return;
    if (inFile.get() && !inFile.get().startsWith("data:"))
    {
        if (addCacheBuster === true)url += "?rnd=" + CABLES.generateUUID();
    }
    needsMatUpdate = true;
    outLoading.set(true);
    fetch(url)
        .then((res) => { return res.arrayBuffer(); })
        .then((arrayBuffer) =>
        {
            if (inFile.get() != fileToLoad)
            {
                cgl.patch.loading.finished(loadingId);
                loadingId = null;
                return;
            }

            boundingPoints = [];
            maxTime = 0;
            gltf = parseGltf(arrayBuffer);
            arrayBuffer = null;
            finishLoading();
        }).catch((e) =>
        {
            if (loadingId)cgl.patch.loading.finished(loadingId);
            loadingId = null;
            finishLoading();

            op.logError("gltf fetch error", e);
        });
    closeTab();

    const oReq = new XMLHttpRequest();
    oReq.open("GET", url, true);
    oReq.responseType = "arraybuffer";

    cgl.patch.loading.addAssetLoadingTask(() =>
    {

    });
}

// op.onFileChanged = function (fn)
// {
//     gltf.accBuffersDelete[i];
//     if (fn && fn.length > 3 && inFile.get() && inFile.get().indexOf(fn) > -1) reloadSoon(true);
// };

op.onFileChanged = function (fn)
{
    if (inFile.get() && inFile.get().indexOf(fn) > -1)
    {
        reloadSoon(true);
    }
};

inActive.onChange = () =>
{
    if (inActive.get()) reloadSoon();

    if (!inActive.get())
    {
        gltf = null;
    }
};

function reloadSoon(nocache)
{
    clearTimeout(timedLoader);
    timedLoader = setTimeout(function () { loadBin(nocache); }, 30);
}

function updateMaterials()
{
    if (!gltf) return;

    gltf.shaders = {};

    if (inMaterials.links.length == 1 && inMaterials.get())
    {
        // just accept a associative object with s
        needsMatUpdate = true;
        const op = inMaterials.links[0].portOut.op;

        const portShader = op.getPort("Shader");
        const portName = op.getPort("Material Name");

        if (!portShader && !portName)
        {
            const inMats = inMaterials.get();
            for (let matname in inMats)
            {
                if (inMats[matname] && gltf.json.materials)
                    for (let i = 0; i < gltf.json.materials.length; i++)
                    {
                        if (gltf.json.materials[i].name == matname)
                        {
                            if (gltf.shaders[i])
                            {
                                op.warn("double material assignment:", name);
                            }
                            gltf.shaders[i] = inMats[matname];
                        }
                    }
            }
        }
    }

    if (inMaterials.get())
    {
        for (let j = 0; j < inMaterials.links.length; j++)
        {
            const op = inMaterials.links[j].portOut.op;
            const portShader = op.getPort("Shader");
            const portName = op.getPort("Material Name");

            if (portShader && portName && portShader.get())
            {
                const name = portName.get();
                if (gltf.json.materials)
                    for (let i = 0; i < gltf.json.materials.length; i++)
                        if (gltf.json.materials[i].name == name)
                        {
                            if (gltf.shaders[i])
                            {
                                op.warn("double material assignment:", name);
                            }
                            gltf.shaders[i] = portShader.get();
                        }
            }
        }
    }
    needsMatUpdate = false;
    if (tab)printInfo();
}

function hideNodesFromArray()
{
    const hideArr = inHideNodes.get();

    if (!gltf || !data || !data.hiddenNodes) return;
    if (!hideArr)
    {
        return;
    }

    for (let i = 0; i < hideArr.length; i++)
    {
        const n = gltf.getNode(hideArr[i]);
        if (n)n.hidden = true;
    }
}

function hideNodesFromData()
{
    if (!data)loadData();
    if (!gltf) return;

    gltf.unHideAll();

    if (data && data.hiddenNodes)
    {
        for (const i in data.hiddenNodes)
        {
            const n = gltf.getNode(i);
            if (n) n.hidden = true;
            else op.verbose("node to be hidden not found", i, n);
        }
    }
    hideNodesFromArray();
}

function loadData()
{
    data = dataPort.get();

    if (!data || data === "")data = {};
    else data = JSON.parse(data);

    if (gltf)hideNodesFromData();

    return data;
}

function saveData()
{
    dataPort.set(JSON.stringify(data));
}

function updateAnimation()
{
    if (gltf && gltf.nodes)
    {
        for (let i = 0; i < gltf.nodes.length; i++)
        {
            gltf.nodes[i].setAnimAction(inAnimation.get());
        }
        const animName = inAnimation.get() || Object.keys(maxTimeDict)[0];
        maxTime = maxTimeDict[animName] || -1;
        outAnimLength.set(maxTime);
    }
}

function findParents(nodes, childNodeIndex)
{
    for (let i = 0; i < gltf.nodes.length; i++)
    {
        if (gltf.nodes[i].children.indexOf(childNodeIndex) >= 0)
        {
            nodes.push(gltf.nodes[i]);
            if (gltf.nodes[i].isChild) findParents(nodes, i);
        }
    }
}

op.exposeTexture = function (name)
{
    const newop = gui.corePatch().addOp("Ops.Gl.GLTF.GltfTexture");
    newop.getPort("Name").set(name);
    setNewOpPosition(newop, 1);
    op.patch.link(op, next.name, newop, "Render");
    gui.patchView.testCollision(newop);
    gui.patchView.centerSelectOp(newop.id, true);
};

op.exposeGeom = function (name, idx)
{
    const newop = gui.corePatch().addOp("Ops.Gl.GLTF.GltfGeometry");
    newop.getPort("Name").set(name);
    newop.getPort("Submesh").set(idx);
    setNewOpPosition(newop, 1);
    op.patch.link(op, next.name, newop, "Update");
    gui.patchView.testCollision(newop);
    gui.patchView.centerSelectOp(newop.id, true);
};

function setNewOpPosition(newOp, num)
{
    num = num || 1;

    newOp.setUiAttrib(
        {
            "subPatch": op.uiAttribs.subPatch,
            "translate": { "x": op.uiAttribs.translate.x, "y": op.uiAttribs.translate.y + num * CABLES.GLUI.glUiConfig.newOpDistanceY }
        });
}

op.exposeNode = function (name, type, options)
{
    let tree = type == "hierarchy";
    if (tree)
    {
        let ops = [];

        for (let i = 0; i < gltf.nodes.length; i++)
        {
            if (gltf.nodes[i].name == name)
            {
                let arrHierarchy = [];
                const node = gltf.nodes[i];
                findParents(arrHierarchy, i);

                arrHierarchy = arrHierarchy.reverse();
                arrHierarchy.push(node, node);

                let prevPort = next.name;
                let prevOp = op;
                for (let j = 0; j < arrHierarchy.length; j++)
                {
                    const newop = gui.corePatch().addOp("Ops.Gl.GLTF.GltfNode_v2");
                    newop.getPort("Node Name").set(arrHierarchy[j].name);
                    op.patch.link(prevOp, prevPort, newop, "Render");
                    setNewOpPosition(newop, j);

                    if (j == arrHierarchy.length - 1)
                    {
                        newop.getPort("Transformation").set(false);
                    }
                    else
                    {
                        newop.getPort("Draw Mesh").set(false);
                        newop.getPort("Draw Childs").set(false);
                    }

                    prevPort = "Next";
                    prevOp = newop;
                    ops.push(newop);
                    gui.patchView.testCollision(newop);
                }
            }
        }

        for (let i = 0; i < ops.length; i++)
        {
            ops[i].selectChilds();
        }
    }
    else
    {
        let newopname = "Ops.Gl.GLTF.GltfNode_v2";
        if (options && options.skin)newopname = "Ops.Gl.GLTF.GltfSkin";
        if (type == "transform")newopname = "Ops.Gl.GLTF.GltfNodeTransform_v2";

        gui.serverOps.loadOpLibs(newopname, () =>
        {
            let newop = gui.corePatch().addOp(newopname);

            newop.getPort("Node Name").set(name);
            setNewOpPosition(newop);
            op.patch.link(op, next.name, newop, "Render");
            gui.patchView.testCollision(newop);
            gui.patchView.centerSelectOp(newop.id, true);
        });
    }
    gui.closeModal();
};

op.assignMaterial = function (name)
{
    const newop = gui.corePatch().addOp("Ops.Gl.GLTF.GltfSetMaterial");
    newop.getPort("Material Name").set(name);
    op.patch.link(op, inMaterials.name, newop, "Material");
    setNewOpPosition(newop);
    gui.patchView.testCollision(newop);
    gui.patchView.centerSelectOp(newop.id, true);

    gui.closeModal();
};

op.toggleNodeVisibility = function (name)
{
    const n = gltf.getNode(name);
    n.hidden = !n.hidden;
    data.hiddenNodes = data.hiddenNodes || {};

    if (n)
        if (n.hidden)data.hiddenNodes[name] = true;
        else delete data.hiddenNodes[name];

    saveData();
};

}
};

CABLES.OPS["c9cbb226-46f7-4ca6-8dab-a9d0bdca4331"]={f:Ops.Gl.GLTF.GltfScene_v4,objName:"Ops.Gl.GLTF.GltfScene_v4"};




// **************************************************************
// 
// Ops.Gl.Texture_v2
// 
// **************************************************************

Ops.Gl.Texture_v2= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const
    filename = op.inUrl("File", [".jpg", ".png", ".webp", ".jpeg", ".avif"]),
    tfilter = op.inSwitch("Filter", ["nearest", "linear", "mipmap"]),
    wrap = op.inValueSelect("Wrap", ["repeat", "mirrored repeat", "clamp to edge"], "clamp to edge"),
    aniso = op.inSwitch("Anisotropic", ["0", "1", "2", "4", "8", "16"], "0"),
    dataFrmt = op.inSwitch("Data Format", ["R", "RG", "RGB", "RGBA", "SRGBA"], "RGBA"),
    flip = op.inValueBool("Flip", false),
    unpackAlpha = op.inValueBool("Pre Multiplied Alpha", false),
    active = op.inValueBool("Active", true),
    inFreeMemory = op.inBool("Save Memory", true),
    textureOut = op.outTexture("Texture"),
    addCacheBust = op.inBool("Add Cachebuster", false),
    inReload = op.inTriggerButton("Reload"),
    width = op.outNumber("Width"),
    height = op.outNumber("Height"),
    ratio = op.outNumber("Aspect Ratio"),
    loaded = op.outBoolNum("Loaded", 0),
    loading = op.outBoolNum("Loading", 0);

const cgl = op.patch.cgl;

op.toWorkPortsNeedToBeLinked(textureOut);
op.setPortGroup("Size", [width, height]);

let loadedFilename = null;
let loadingId = null;
let tex = null;
let cgl_filter = CGL.Texture.FILTER_MIPMAP;
let cgl_wrap = CGL.Texture.WRAP_REPEAT;
let cgl_aniso = 0;
let timedLoader = 0;

unpackAlpha.setUiAttribs({ "hidePort": true });
unpackAlpha.onChange =
    filename.onChange =
    dataFrmt.onChange =
    addCacheBust.onChange =
    flip.onChange = reloadSoon;
aniso.onChange = tfilter.onChange = onFilterChange;
wrap.onChange = onWrapChange;

tfilter.set("mipmap");
wrap.set("repeat");

textureOut.setRef(CGL.Texture.getEmptyTexture(cgl));

inReload.onTriggered = reloadSoon;

active.onChange = function ()
{
    if (active.get())
    {
        if (loadedFilename != filename.get() || !tex) reloadSoon();
        else textureOut.setRef(tex);
    }
    else
    {
        textureOut.setRef(CGL.Texture.getEmptyTexture(cgl));
        width.set(CGL.Texture.getEmptyTexture(cgl).width);
        height.set(CGL.Texture.getEmptyTexture(cgl).height);
        if (tex)tex.delete();
        op.setUiAttrib({ "extendTitle": "" });
        tex = null;
    }
};

const setTempTexture = function ()
{
    const t = CGL.Texture.getTempTexture(cgl);
    textureOut.setRef(t);
};

function reloadSoon(nocache)
{
    clearTimeout(timedLoader);
    timedLoader = setTimeout(function ()
    {
        realReload(nocache);
    }, 1);
}

function getPixelFormat()
{
    if (dataFrmt.get() == "R") return CGL.Texture.PFORMATSTR_R8UB;
    if (dataFrmt.get() == "RG") return CGL.Texture.PFORMATSTR_RG8UB;
    if (dataFrmt.get() == "RGB") return CGL.Texture.PFORMATSTR_RGB8UB;
    if (dataFrmt.get() == "SRGBA") return CGL.Texture.PFORMATSTR_SRGBA8;

    return CGL.Texture.PFORMATSTR_RGBA8UB;
}

function realReload(nocache)
{
    op.checkMainloopExists();
    if (!active.get()) return;
    if (loadingId)loadingId = cgl.patch.loading.finished(loadingId);

    loadingId = cgl.patch.loading.start(op.objName, filename.get(), op);

    let url = op.patch.getFilePath(String(filename.get()));

    if (addCacheBust.get() || nocache === true) url = CABLES.cacheBust(url);

    if (String(filename.get()).indexOf("data:") == 0) url = filename.get();

    let needsRefresh = false;
    loadedFilename = filename.get();

    if ((filename.get() && filename.get().length > 1))
    {
        loaded.set(false);
        loading.set(true);

        const fileToLoad = filename.get();

        op.setUiAttrib({ "extendTitle": CABLES.basename(url) });
        if (needsRefresh) op.refreshParams();

        cgl.patch.loading.addAssetLoadingTask(() =>
        {
            op.setUiError("urlerror", null);
            CGL.Texture.load(cgl, url, function (err, newTex)
            {
                // cgl.checkFrameStarted("texture inittexture");

                if (filename.get() != fileToLoad)
                {
                    loadingId = cgl.patch.loading.finished(loadingId);
                    return;
                }

                if (tex)tex.delete();

                if (err)
                {
                    const t = CGL.Texture.getErrorTexture(cgl);
                    textureOut.setRef(t);

                    op.setUiError("urlerror", "could not load texture: \"" + filename.get() + "\"", 2);
                    loadingId = cgl.patch.loading.finished(loadingId);
                    return;
                }

                // textureOut.setRef(newTex);

                width.set(newTex.width);
                height.set(newTex.height);
                ratio.set(newTex.width / newTex.height);

                // if (!newTex.isPowerOfTwo()) op.setUiError("npot", "Texture dimensions not power of two! - Texture filtering will not work in WebGL 1.", 0);
                // else op.setUiError("npot", null);

                tex = newTex;
                // textureOut.setRef(null);
                textureOut.setRef(tex);

                loading.set(false);
                loaded.set(true);

                if (inFreeMemory.get()) tex.image = null;

                if (loadingId)
                {
                    loadingId = cgl.patch.loading.finished(loadingId);
                }
                op.checkMainloopExists();
            }, {
                "anisotropic": cgl_aniso,
                "wrap": cgl_wrap,
                "flip": flip.get(),
                "unpackAlpha": unpackAlpha.get(),
                "pixelFormat": getPixelFormat(),
                "filter": cgl_filter
            });

            op.checkMainloopExists();
        });
    }
    else
    {
        setTempTexture();
        loadingId = cgl.patch.loading.finished(loadingId);
    }
}

function onFilterChange()
{
    if (tfilter.get() == "nearest") cgl_filter = CGL.Texture.FILTER_NEAREST;
    else if (tfilter.get() == "linear") cgl_filter = CGL.Texture.FILTER_LINEAR;
    else if (tfilter.get() == "mipmap") cgl_filter = CGL.Texture.FILTER_MIPMAP;
    else if (tfilter.get() == "Anisotropic") cgl_filter = CGL.Texture.FILTER_ANISOTROPIC;
    aniso.setUiAttribs({ "greyout": cgl_filter != CGL.Texture.FILTER_MIPMAP });

    cgl_aniso = parseFloat(aniso.get());

    reloadSoon();
}

function onWrapChange()
{
    if (wrap.get() == "repeat") cgl_wrap = CGL.Texture.WRAP_REPEAT;
    if (wrap.get() == "mirrored repeat") cgl_wrap = CGL.Texture.WRAP_MIRRORED_REPEAT;
    if (wrap.get() == "clamp to edge") cgl_wrap = CGL.Texture.WRAP_CLAMP_TO_EDGE;

    reloadSoon();
}

op.onFileChanged = function (fn)
{
    if (filename.get() && filename.get().indexOf(fn) > -1)
    {
        textureOut.setRef(CGL.Texture.getEmptyTexture(op.patch.cgl));
        textureOut.setRef(CGL.Texture.getTempTexture(cgl));
        realReload(true);
    }
};

}
};

CABLES.OPS["790f3702-9833-464e-8e37-6f0f813f7e16"]={f:Ops.Gl.Texture_v2,objName:"Ops.Gl.Texture_v2"};




// **************************************************************
// 
// Ops.Vars.VarSetObject_v2
// 
// **************************************************************

Ops.Vars.VarSetObject_v2= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const val = op.inObject("Value", null);
op.varName = op.inDropDown("Variable", [], "", true);

new CABLES.VarSetOpWrapper(op, "object", val, op.varName);

}
};

CABLES.OPS["c7608375-5b45-4bca-87ef-d0c5e970779a"]={f:Ops.Vars.VarSetObject_v2,objName:"Ops.Vars.VarSetObject_v2"};




// **************************************************************
// 
// Ops.Vars.VarGetObject_v2
// 
// **************************************************************

Ops.Vars.VarGetObject_v2= class extends CABLES.Op 
{
constructor()
{
super(...arguments);
const op=this;
const attachments=op.attachments={};
const val = op.outObject("Value");
op.varName = op.inValueSelect("Variable", [], "", true);

new CABLES.VarGetOpWrapper(op, "object", op.varName, val);

}
};

CABLES.OPS["321419d9-69c7-4310-a327-93d310bc2b8e"]={f:Ops.Vars.VarGetObject_v2,objName:"Ops.Vars.VarGetObject_v2"};



window.addEventListener('load', function(event) {
CABLES.jsLoaded=new Event('CABLES.jsLoaded');
document.dispatchEvent(CABLES.jsLoaded);
});
