import React, { memo, useEffect, useRef, useState } from 'react';
import './AIOrb.css';

const VERTEX_SHADER = `
  attribute vec2 aPosition;

  void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uLevel;
  uniform float uEnergy;
  uniform float uSpeaking;
  uniform float uExpressive;
  uniform vec4 uLeftEye;
  uniform vec4 uRightEye;
  uniform vec2 uGazeOffset;
  uniform vec2 uEyeRotation;
  uniform float uEyeBrightness;
  uniform float uEyeWander;
  uniform float uEyeBlink;
  uniform float uThinking;
  uniform float uListening;
  uniform float uListeningTime;
  uniform float uOrbitPhase;
  uniform float uMotion;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uAccent;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.52;
    mat2 turn = mat2(0.80, -0.60, 0.60, 0.80);

    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p = turn * p * 2.03 + 17.17;
      amplitude *= 0.49;
    }

    return value;
  }

  float glowLine(float distanceFromLine, float width) {
    float normalized = distanceFromLine / width;
    return exp(-(normalized * normalized));
  }

  float softWindow(float value, float start, float enterEnd, float exitStart, float end) {
    return smoothstep(start, enterEnd, value)
      * (1.0 - smoothstep(exitStart, end, value));
  }

  float roundedBox(vec2 p, vec2 halfSize, float radius) {
    vec2 d = abs(p) - halfSize + radius;
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - radius;
  }

  vec2 rotatePoint(vec2 point, float angle) {
    float cosine = cos(angle);
    float sine = sin(angle);
    return mat2(cosine, -sine, sine, cosine) * point;
  }

  void over(inout vec3 destination, inout float destinationAlpha, vec3 source, float sourceAlpha) {
    sourceAlpha = clamp(sourceAlpha, 0.0, 1.0);
    float combinedAlpha = sourceAlpha + destinationAlpha * (1.0 - sourceAlpha);
    destination = combinedAlpha > 0.0001
      ? (source * sourceAlpha + destination * destinationAlpha * (1.0 - sourceAlpha)) / combinedAlpha
      : vec3(0.0);
    destinationAlpha = combinedAlpha;
  }

  void addBubble(
    inout vec3 color,
    inout float alpha,
    vec2 point,
    vec2 center,
    float radius,
    float phase
  ) {
    vec2 local = point - center;
    float distanceToCenter = length(local);
    float mask = 1.0 - smoothstep(radius - 0.010, radius + 0.010, distanceToCenter);
    float radial = clamp(distanceToCenter / radius, 0.0, 1.0);
    float sphereZ = sqrt(max(0.0, 1.0 - radial * radial));
    vec3 normal = normalize(vec3(local / radius, sphereZ));
    vec3 lightDirection = normalize(vec3(-0.65, 0.78, 1.15));
    float diffuse = max(0.0, dot(normal, lightDirection));
    float specular = pow(diffuse, 28.0);
    float fresnel = pow(1.0 - sphereZ, 2.1);
    float liquid = fbm(local * 12.0 + vec2(phase, -phase * 0.7));
    vec3 bubbleColor = mix(uSecondary, uAccent, radial * 0.62 + liquid * 0.22);
    bubbleColor = mix(bubbleColor, vec3(1.0), specular * 0.95 + fresnel * 0.48);
    bubbleColor += uPrimary * diffuse * 0.15;

    float halo = glowLine(max(distanceToCenter - radius, 0.0), radius * 0.58)
      * (1.0 - smoothstep(radius, radius * 2.0, distanceToCenter));
    over(color, alpha, mix(uAccent, vec3(1.0), 0.58), halo * 0.16);
    over(color, alpha, bubbleColor, mask * 0.92);

    float rim = glowLine(abs(distanceToCenter - radius), 0.010);
    over(color, alpha, vec3(1.0), rim * 0.72);
  }

  void main() {
    float minimumResolution = min(uResolution.x, uResolution.y);
    vec2 point = (gl_FragCoord.xy - uResolution * 0.5) * 2.0 / minimumResolution;

    float animatedTime = uTime * uMotion;
    float voice = smoothstep(0.03, 0.82, uLevel);
    float speaking = smoothstep(0.02, 0.98, uSpeaking);
    float expressive = step(0.5, uExpressive);
    float lift = sin(animatedTime * 0.78) * 0.014 * uMotion;
    vec2 spherePoint = point - vec2(0.0, lift);
    float distanceToCenter = length(spherePoint);
    float angle = atan(spherePoint.y, spherePoint.x);
    float pulse = (sin(animatedTime * (2.0 + uEnergy * 1.8)) * 0.5 + 0.5)
      * (0.003 + voice * 0.009) * uMotion;
    float speakingExpansion = expressive * speaking * (0.040 + voice * 0.018);
    float speakingBreath = expressive * speaking * sin(animatedTime * 2.45) * 0.006 * uMotion;
    float bodyRadius = 0.665 + speakingExpansion + speakingBreath + pulse;

    vec3 color = vec3(0.0);
    float alpha = 0.0;

    // A wide, soft contact shadow anchors the otherwise weightless glass.
    float floorShadow = exp(
      -pow(spherePoint.x / 0.43, 2.0)
      -pow((spherePoint.y + 0.79) / 0.075, 2.0)
    );
    over(color, alpha, mix(uPrimary, uAccent, 0.42), floorShadow * 0.20);

    // Diffuse aura. It fades over a large range so it never reads as a border.
    float outside = max(distanceToCenter - bodyRadius, 0.0);
    float atmosphere = exp(-pow(outside / 0.27, 2.0))
      * (1.0 - smoothstep(0.94, 1.14, distanceToCenter));
    float atmospherePulse = 0.84 + 0.16 * sin(animatedTime * 1.25 + 0.6) * uMotion;
    over(
      color,
      alpha,
      mix(uAccent, vec3(1.0), 0.74),
      atmosphere * (0.12 + uEnergy * 0.045 + voice * 0.035) * atmospherePulse
    );

    // Side-only resonance arcs echo the reference without enclosing the orb.
    float safeDistance = max(distanceToCenter, 0.001);
    vec2 radialDirection = spherePoint / safeDistance;
    float sideMask = smoothstep(0.28, 0.83, abs(radialDirection.x));
    sideMask *= 0.72 + 0.28 * sin(angle * 5.0 + animatedTime * 1.35) * uMotion;
    float arcExpansion = voice * 0.018 * sin(animatedTime * 5.2) * uMotion;
    float arcOne = glowLine(abs(distanceToCenter - (bodyRadius + 0.100 + arcExpansion)), 0.010);
    float arcTwo = glowLine(abs(distanceToCenter - (bodyRadius + 0.157 + arcExpansion * 1.35)), 0.009);
    float arcThree = glowLine(abs(distanceToCenter - (bodyRadius + 0.213 + arcExpansion * 1.75)), 0.008);
    float arcStrength = sideMask * (0.24 + uEnergy * 0.26 + voice * 0.24);
    vec3 arcColor = mix(uAccent, uSecondary, smoothstep(-0.85, 0.85, spherePoint.x));
    over(color, alpha, mix(arcColor, vec3(1.0), 0.34), arcOne * arcStrength);
    over(color, alpha, mix(arcColor, vec3(1.0), 0.52), arcTwo * arcStrength * 0.68);
    over(color, alpha, arcColor, arcThree * arcStrength * 0.42);

    // Companion droplets use an integrated phase supplied by JavaScript. This
    // keeps their position continuous while their speaking speed eases up or down.
    float orbitTime = uOrbitPhase * uMotion;
    float orbitRadiusX = bodyRadius + 0.095;
    float orbitRadiusY = bodyRadius + 0.045;
    float satelliteOneAngle = 2.30 + orbitTime;
    float satelliteTwoAngle = 3.75 + orbitTime * 0.84;
    float satelliteThreeAngle = 5.72 + orbitTime * 1.12;
    float satelliteOneDepth = sin(satelliteOneAngle) * 0.5 + 0.5;
    float satelliteTwoDepth = sin(satelliteTwoAngle) * 0.5 + 0.5;
    float satelliteThreeDepth = sin(satelliteThreeAngle) * 0.5 + 0.5;
    vec2 satelliteOneCenter = mix(
      vec2(-0.55, 0.61 + sin(animatedTime * 0.92 + 0.4) * 0.018 * uMotion),
      vec2(cos(satelliteOneAngle) * orbitRadiusX, sin(satelliteOneAngle) * orbitRadiusY),
      expressive
    );
    vec2 satelliteTwoCenter = mix(
      vec2(-0.68, -0.47 + sin(animatedTime * 1.06 + 2.2) * 0.014 * uMotion),
      vec2(cos(satelliteTwoAngle) * orbitRadiusX, sin(satelliteTwoAngle) * orbitRadiusY),
      expressive
    );
    vec2 satelliteThreeCenter = mix(
      vec2(0.69, -0.43 + sin(animatedTime * 0.84 + 4.1) * 0.020 * uMotion),
      vec2(cos(satelliteThreeAngle) * orbitRadiusX, sin(satelliteThreeAngle) * orbitRadiusY),
      expressive
    );

    addBubble(
      color,
      alpha,
      point,
      satelliteOneCenter,
      mix(0.091, 0.076 + satelliteOneDepth * 0.020, expressive),
      animatedTime * 0.16
    );
    addBubble(
      color,
      alpha,
      point,
      satelliteTwoCenter,
      mix(0.071, 0.060 + satelliteTwoDepth * 0.018, expressive),
      animatedTime * 0.13 + 2.0
    );
    addBubble(
      color,
      alpha,
      point,
      satelliteThreeCenter,
      mix(0.101, 0.082 + satelliteThreeDepth * 0.022, expressive),
      animatedTime * 0.11 + 4.0
    );

    // Domain-warped liquid. The contour itself moves slightly, not just the colors.
    vec2 normalizedPoint = spherePoint / bodyRadius;
    float broadFlow = fbm(
      normalizedPoint * 1.72
      + vec2(animatedTime * 0.075, -animatedTime * 0.052)
    );
    vec2 domainWarp = vec2(
      fbm(normalizedPoint * 2.10 + broadFlow * 1.8 + animatedTime * 0.040),
      fbm(normalizedPoint * 2.32 - broadFlow * 1.5 - animatedTime * 0.034)
    ) - 0.5;
    float contour = (broadFlow - 0.5) * 0.016 * uMotion * (0.45 + uEnergy * 0.55);
    contour += sin(angle * 4.0 + animatedTime * 0.65) * 0.0035 * uMotion;
    float surfaceDistance = distanceToCenter - bodyRadius - contour;
    float bodyMask = 1.0 - smoothstep(-0.005, 0.012, surfaceDistance);
    float radial = clamp(distanceToCenter / bodyRadius, 0.0, 1.0);
    float sphereZ = sqrt(max(0.0, 1.0 - radial * radial));
    vec3 normal = normalize(vec3(spherePoint / bodyRadius, sphereZ));

    vec2 liquidPoint = normalizedPoint + domainWarp * (0.28 + uEnergy * 0.08);
    float filament = fbm(liquidPoint * 3.15 + vec2(-animatedTime * 0.055, animatedTime * 0.08));
    float veil = fbm(liquidPoint * 1.56 - vec2(animatedTime * 0.035, animatedTime * 0.045));
    float sweep = sin((liquidPoint.x * 1.4 + liquidPoint.y) * 3.2 + animatedTime * 0.32);

    vec3 bodyColor = mix(
      uSecondary,
      uPrimary,
      smoothstep(
        -0.18,
        0.94,
        normalizedPoint.x - normalizedPoint.y * 0.24 + (broadFlow - 0.5) * 0.38
      )
    );
    bodyColor = mix(bodyColor, uAccent, smoothstep(0.52, 0.91, filament) * 0.68);
    bodyColor = mix(bodyColor, vec3(0.78, 0.72, 1.0), smoothstep(0.22, 0.86, veil) * 0.19);
    bodyColor += uAccent * max(sweep, 0.0) * 0.045;
    bodyColor *= 0.91 + sphereZ * 0.13;

    vec3 keyLight = normalize(vec3(-0.63, 0.72, 1.10));
    float key = max(0.0, dot(normal, keyLight));
    float specular = pow(key, 22.0);
    float hotSpecular = pow(key, 78.0);
    float fresnel = pow(1.0 - sphereZ, 2.15);
    bodyColor += vec3(1.0) * (specular * 0.22 + hotSpecular * 0.86);
    bodyColor = mix(bodyColor, mix(uAccent, vec3(1.0), 0.36), fresnel * 0.29);
    bodyColor *= 1.0 - smoothstep(0.58, 1.0, radial) * 0.09;
    over(color, alpha, bodyColor, bodyMask * 0.975);

    // Translucent moving caustics remain inside the glass volume.
    vec2 cyanCenter = vec2(0.43 + domainWarp.x * 0.22, -0.37 + domainWarp.y * 0.18);
    vec2 violetCenter = vec2(-0.18 - domainWarp.y * 0.20, 0.14 + domainWarp.x * 0.16);
    float cyanCloud = exp(-dot(normalizedPoint - cyanCenter, normalizedPoint - cyanCenter) * 3.2);
    float violetCloud = exp(-dot(normalizedPoint - violetCenter, normalizedPoint - violetCenter) * 2.8);
    over(color, alpha, uAccent, cyanCloud * bodyMask * 0.20);
    over(color, alpha, uSecondary, violetCloud * bodyMask * 0.27);

    // A layered white shell gives glass thickness without a cyan outline.
    float innerRim = glowLine(abs(surfaceDistance), 0.013);
    float glassVolume = glowLine(abs(distanceToCenter - (bodyRadius + 0.047)), 0.058);
    float shellOne = glowLine(abs(distanceToCenter - (bodyRadius + 0.028)), 0.016);
    float shellTwo = glowLine(abs(distanceToCenter - (bodyRadius + 0.068)), 0.024);
    float directional = 0.36
      + 0.64 * pow(max(0.0, dot(radialDirection, vec2(-0.66, 0.75))), 2.0);
    float lowerBounce = pow(max(0.0, dot(radialDirection, vec2(0.34, -0.94))), 4.0);
    over(color, alpha, mix(vec3(1.0), uAccent, 0.08), glassVolume * (0.08 + directional * 0.10));
    over(color, alpha, mix(uAccent, vec3(1.0), 0.90), innerRim * (0.36 + directional * 0.42));
    over(color, alpha, vec3(1.0), shellOne * (0.24 + directional * 0.48));
    over(color, alpha, mix(vec3(1.0), uAccent, 0.10), shellTwo * (0.13 + directional * 0.24));
    over(color, alpha, mix(uAccent, vec3(1.0), 0.56), innerRim * lowerBounce * 0.42);

    // Long glass highlights are soft arcs rather than painted white blobs.
    float topArc = glowLine(abs(distanceToCenter - bodyRadius * 0.88), 0.040)
      * pow(max(0.0, dot(radialDirection, normalize(vec2(-0.58, 0.82)))), 8.0);
    float rightArc = glowLine(abs(distanceToCenter - bodyRadius * 0.91), 0.028)
      * pow(max(0.0, dot(radialDirection, normalize(vec2(0.92, 0.38)))), 10.0);
    over(color, alpha, vec3(1.0), topArc * bodyMask * 0.52);
    over(color, alpha, mix(vec3(1.0), uAccent, 0.25), rightArc * bodyMask * 0.22);

    // The two original capsule eyes carry the expression system. State changes
    // alter their pose while a restrained shared gaze and blink keep them alive.
    float blinkPhase = fract((uTime + 0.74) / 5.7);
    float blinkEvent = smoothstep(0.915, 0.945, blinkPhase)
      * (1.0 - smoothstep(0.966, 0.994, blinkPhase));
    float blink = mix(1.0, 0.10, blinkEvent * uEyeBlink * uMotion);
    vec2 ambientGaze = vec2(
      sin(animatedTime * 0.61) + sin(animatedTime * 0.23 + 1.4),
      cos(animatedTime * 0.49 + 0.8) + sin(animatedTime * 0.19 + 2.1)
    ) * 0.0065 * uEyeWander * uMotion;
    float pointerGazeStrength = smoothstep(0.004, 0.095, length(uGazeOffset));
    float pointerGazeX = clamp(uGazeOffset.x / 0.090, -1.0, 1.0);
    float pointerGazeY = clamp(uGazeOffset.y / 0.075, -1.0, 1.0);
    ambientGaze *= 1.0 - pointerGazeStrength * 0.86;
    vec2 thinkingDrift = vec2(
      sin(animatedTime * 1.17 + 0.4),
      cos(animatedTime * 1.31 + 1.1)
    ) * 0.006 * uThinking * uMotion;
    float conversationalBeat = sin(animatedTime * 7.1)
      * speaking * voice * uMotion;

    // Listening borrows Bloub's readable eye gestures without changing the orb
    // silhouette: curious asymmetry, an excited lift, a shared glance, then a
    // one-eye acknowledgement. Neutral gaps keep it present rather than performative.
    float listeningCycle = mod(uListeningTime, 13.4);
    float listeningCurious = softWindow(listeningCycle, 1.35, 2.02, 2.88, 3.55)
      * uListening * uMotion;
    float listeningExcited = softWindow(listeningCycle, 4.38, 4.92, 5.64, 6.22)
      * uListening * uMotion;
    float listeningGlance = softWindow(listeningCycle, 7.02, 7.68, 8.66, 9.32)
      * uListening * uMotion;
    float listeningAcknowledge = softWindow(listeningCycle, 10.62, 10.89, 11.29, 11.66)
      * uListening * uMotion;
    float excitedSpark = listeningExcited
      * (0.5 + 0.5 * sin(uListeningTime * 8.4));
    blink = mix(blink, 1.0, listeningExcited);

    vec2 leftEyeCenter = uLeftEye.xy + ambientGaze + thinkingDrift + uGazeOffset;
    vec2 rightEyeCenter = uRightEye.xy + ambientGaze + thinkingDrift + uGazeOffset;
    leftEyeCenter.y += conversationalBeat * 0.010;
    rightEyeCenter.y -= conversationalBeat * 0.008;
    vec2 listeningLook = vec2(-0.024, 0.012) * listeningGlance;
    leftEyeCenter += listeningLook;
    rightEyeCenter += listeningLook;
    leftEyeCenter += vec2(0.011, 0.008) * listeningCurious;
    rightEyeCenter += vec2(0.020, 0.017) * listeningCurious;
    float excitedLift = listeningExcited * 0.017 + excitedSpark * 0.005;
    leftEyeCenter += vec2(listeningExcited * 0.018, excitedLift);
    rightEyeCenter += vec2(-listeningExcited * 0.018, excitedLift);
    leftEyeCenter.y += 0.011 * listeningAcknowledge;
    leftEyeCenter.x -= pointerGazeStrength * 0.008;
    rightEyeCenter.x += pointerGazeStrength * 0.008;

    vec2 leftEyeSize = uLeftEye.zw;
    vec2 rightEyeSize = uRightEye.zw;
    leftEyeSize.y *= blink * (1.0 + conversationalBeat * 0.045);
    rightEyeSize.y *= blink * (1.0 - conversationalBeat * 0.038);
    leftEyeSize *= vec2(1.0 - listeningCurious * 0.02, 1.0 - listeningCurious * 0.14);
    rightEyeSize *= vec2(1.0 + listeningCurious * 0.06, 1.0 + listeningCurious * 0.12);
    leftEyeSize *= vec2(1.0 + listeningExcited * 0.14, 1.0 + listeningExcited * 0.3);
    rightEyeSize *= vec2(1.0 + listeningExcited * 0.14, 1.0 + listeningExcited * 0.3);
    leftEyeSize.y *= 1.0 - listeningAcknowledge * 0.68;
    leftEyeSize.x *= 1.0 + listeningAcknowledge * 0.16;
    float gazeNearEye = pointerGazeX * pointerGazeStrength;
    float gazeLift = max(pointerGazeY, 0.0) * pointerGazeStrength;
    leftEyeSize *= vec2(
      1.0 + pointerGazeStrength * 0.12,
      1.0 + pointerGazeStrength * 0.18 - gazeNearEye * 0.10 + gazeLift * 0.08
    );
    rightEyeSize *= vec2(
      1.0 + pointerGazeStrength * 0.12,
      1.0 + pointerGazeStrength * 0.18 + gazeNearEye * 0.10 + gazeLift * 0.08
    );

    float pointerLean = -pointerGazeX * pointerGazeStrength * 0.18;

    float leftEyeRotation = uEyeRotation.x
      - listeningCurious * 0.09
      + listeningExcited * 0.12
      + listeningAcknowledge * 0.16
      + pointerLean;
    float rightEyeRotation = uEyeRotation.y
      - listeningCurious * 0.12
      - listeningExcited * 0.12
      + pointerLean;

    vec2 leftEyePoint = rotatePoint(
      spherePoint - leftEyeCenter,
      -leftEyeRotation
    );
    vec2 rightEyePoint = rotatePoint(
      spherePoint - rightEyeCenter,
      -rightEyeRotation
    );
    float leftEyeDistance = roundedBox(
      leftEyePoint,
      leftEyeSize,
      min(leftEyeSize.x, leftEyeSize.y) * 0.92
    );
    float rightEyeDistance = roundedBox(
      rightEyePoint,
      rightEyeSize,
      min(rightEyeSize.x, rightEyeSize.y) * 0.92
    );
    float eyeDistance = min(leftEyeDistance, rightEyeDistance);
    float eyeGlow = glowLine(max(eyeDistance, 0.0), 0.045) * bodyMask;
    float eyeMask = 1.0 - smoothstep(-0.006, 0.010, eyeDistance);
    float expressionBrightness = uEyeBrightness * (1.0 + listeningExcited * 0.2);
    over(color, alpha, vec3(1.0), eyeGlow * 0.34 * expressionBrightness);
    over(color, alpha, vec3(1.0), eyeMask * bodyMask * min(1.0, 0.90 * expressionBrightness));

    // Tiny motes make the aura atmospheric without turning it into noise.
    vec2 moteGrid = floor((point + 1.0) * vec2(15.0, 14.0));
    vec2 moteCell = fract((point + 1.0) * vec2(15.0, 14.0)) - 0.5;
    float moteSeed = hash21(moteGrid);
    float moteDistance = length(moteCell + vec2(
      sin(animatedTime * 0.42 + moteSeed * 9.0),
      cos(animatedTime * 0.36 + moteSeed * 7.0)
    ) * 0.08 * uMotion);
    float mote = (1.0 - smoothstep(0.022, 0.075, moteDistance))
      * step(0.91, moteSeed)
      * smoothstep(bodyRadius + 0.06, bodyRadius + 0.22, distanceToCenter)
      * (1.0 - smoothstep(0.94, 1.08, distanceToCenter));
    over(color, alpha, vec3(1.0), mote * 0.50);

    float finalAlpha = clamp(alpha, 0.0, 1.0);
    gl_FragColor = vec4(color * finalAlpha, finalAlpha);
  }
`;

const STATE_LABEL = {
  ready: 'AI interviewer is ready',
  speaking: 'AI interviewer is speaking',
  listening: 'AI interviewer is listening',
  thinking: 'AI interviewer is thinking',
  interrupted: 'AI interviewer was interrupted and is listening',
  evaluating: 'AI interviewer is evaluating your response',
  booting: 'AI interviewer is preparing your questions',
  complete: 'Interview session complete',
  offline: 'AI interviewer is disconnected',
  error: 'AI interviewer connection error',
};

const STATE_VISUAL = {
  ready: {
    primary: [0.16, 0.39, 0.98],
    secondary: [0.55, 0.34, 0.98],
    accent: [0.2, 0.8, 1.0],
    energy: 0.2,
    leftEye: [-0.145, 0.008, 0.046, 0.132],
    rightEye: [0.145, 0.008, 0.046, 0.132],
    eyeRotation: [0, 0],
    eyeBrightness: 1,
    eyeWander: 1,
    eyeBlink: 1,
    thinking: 0,
  },
  speaking: {
    primary: [0.12, 0.42, 1.0],
    secondary: [0.59, 0.27, 1.0],
    accent: [0.24, 0.84, 1.0],
    energy: 0.82,
    leftEye: [-0.145, 0.004, 0.048, 0.108],
    rightEye: [0.145, 0.012, 0.048, 0.116],
    eyeRotation: [-0.03, 0.035],
    eyeBrightness: 1.05,
    eyeWander: 0.32,
    eyeBlink: 0.65,
    thinking: 0,
  },
  listening: {
    primary: [0.12, 0.39, 1.0],
    secondary: [0.5, 0.31, 1.0],
    accent: [0.16, 0.86, 1.0],
    energy: 1,
    leftEye: [-0.132, 0.006, 0.047, 0.148],
    rightEye: [0.132, 0.006, 0.047, 0.148],
    eyeRotation: [0, 0],
    eyeBrightness: 1.08,
    eyeWander: 0.18,
    eyeBlink: 0.9,
    thinking: 0,
  },
  thinking: {
    primary: [0.25, 0.3, 0.94],
    secondary: [0.6, 0.32, 1.0],
    accent: [0.39, 0.7, 1.0],
    energy: 0.48,
    leftEye: [-0.112, 0.06, 0.047, 0.084],
    rightEye: [0.162, 0.092, 0.045, 0.118],
    eyeRotation: [-0.16, -0.12],
    eyeBrightness: 1,
    eyeWander: 0.72,
    eyeBlink: 0.55,
    thinking: 1,
  },
  interrupted: {
    primary: [0.12, 0.39, 1.0],
    secondary: [0.5, 0.31, 1.0],
    accent: [0.16, 0.86, 1.0],
    energy: 0.88,
    leftEye: [-0.165, 0.012, 0.054, 0.158],
    rightEye: [0.165, 0.012, 0.054, 0.158],
    eyeRotation: [0, 0],
    eyeBrightness: 1.12,
    eyeWander: 0,
    eyeBlink: 0,
    thinking: 0,
  },
  evaluating: {
    primary: [0.25, 0.3, 0.94],
    secondary: [0.6, 0.32, 1.0],
    accent: [0.39, 0.7, 1.0],
    energy: 0.48,
    leftEye: [-0.112, 0.06, 0.047, 0.084],
    rightEye: [0.162, 0.092, 0.045, 0.118],
    eyeRotation: [-0.16, -0.12],
    eyeBrightness: 1,
    eyeWander: 0.72,
    eyeBlink: 0.55,
    thinking: 1,
  },
  booting: {
    primary: [0.3, 0.43, 0.88],
    secondary: [0.53, 0.43, 0.91],
    accent: [0.46, 0.76, 1.0],
    energy: 0.34,
    leftEye: [-0.145, -0.002, 0.047, 0.09],
    rightEye: [0.145, -0.002, 0.047, 0.09],
    eyeRotation: [0, 0],
    eyeBrightness: 0.82,
    eyeWander: 0.2,
    eyeBlink: 0.7,
    thinking: 0,
  },
  complete: {
    primary: [0.09, 0.58, 0.7],
    secondary: [0.31, 0.44, 0.96],
    accent: [0.28, 0.89, 0.78],
    energy: 0.28,
    leftEye: [-0.14, -0.002, 0.05, 0.078],
    rightEye: [0.14, -0.002, 0.05, 0.078],
    eyeRotation: [-0.14, 0.14],
    eyeBrightness: 1.08,
    eyeWander: 0.35,
    eyeBlink: 0.7,
    thinking: 0,
  },
  offline: {
    primary: [0.36, 0.43, 0.56],
    secondary: [0.49, 0.51, 0.67],
    accent: [0.62, 0.72, 0.82],
    energy: 0,
    leftEye: [-0.14, -0.035, 0.05, 0.06],
    rightEye: [0.14, -0.035, 0.05, 0.06],
    eyeRotation: [0, 0],
    eyeBrightness: 0.55,
    eyeWander: 0.12,
    eyeBlink: 0.45,
    thinking: 0,
  },
  error: {
    primary: [0.86, 0.18, 0.35],
    secondary: [0.47, 0.25, 0.9],
    accent: [1.0, 0.45, 0.58],
    energy: 0.16,
    leftEye: [-0.14, -0.045, 0.05, 0.072],
    rightEye: [0.14, -0.045, 0.05, 0.072],
    eyeRotation: [-0.16, 0.16],
    eyeBrightness: 0.72,
    eyeWander: 0.1,
    eyeBlink: 0.45,
    thinking: 0,
  },
};

function resolveState({
  expressionState,
  isSpeaking,
  isListening,
  isComplete,
  isEvaluating,
  isBooting,
  isOffline,
  hasError,
}) {
  if (expressionState && STATE_VISUAL[expressionState]) return expressionState;
  if (hasError) return 'error';
  if (isComplete) return 'complete';
  if (isListening) return 'listening';
  if (isSpeaking) return 'speaking';
  if (isEvaluating) return 'evaluating';
  if (isBooting) return 'booting';
  if (isOffline) return 'offline';
  return 'ready';
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Unknown shader compilation error';
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
}

function createProgram(gl) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || 'Unknown WebGL program link error';
    gl.deleteProgram(program);
    throw new Error(message);
  }

  return program;
}

function mixNumber(current, target, amount) {
  return current + (target - current) * amount;
}

function mixColor(current, target, amount) {
  current[0] = mixNumber(current[0], target[0], amount);
  current[1] = mixNumber(current[1], target[1], amount);
  current[2] = mixNumber(current[2], target[2], amount);
}

function mixVector(current, target, amount) {
  for (let index = 0; index < current.length; index += 1) {
    current[index] = mixNumber(current[index], target[index], amount);
  }
}

function AIOrbBase({
  isSpeaking = false,
  isListening = false,
  isComplete = false,
  isEvaluating = false,
  isBooting = false,
  isOffline = false,
  hasError = false,
  volume = null,
  ariaLabel = null,
  expressiveMotion = false,
  expressionState = null,
  followPointer = false,
  className = '',
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const drawRef = useRef(null);
  const gazeRef = useRef({ targetX: 0, targetY: 0, x: 0, y: 0 });
  const [rendererState, setRendererState] = useState('checking');

  const state = resolveState({
    expressionState,
    isSpeaking,
    isListening,
    isComplete,
    isEvaluating,
    isBooting,
    isOffline,
    hasError,
  });
  const level = typeof volume === 'number' ? Math.min(1, Math.max(0, volume / 100)) : 0;
  const visualRef = useRef({ state, level, expressiveMotion });
  visualRef.current = { state, level, expressiveMotion };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
    });

    if (!gl) {
      setRendererState('fallback');
      return undefined;
    }

    let program;
    try {
      program = createProgram(gl);
    } catch (error) {
      console.error('AI orb WebGL renderer could not start:', error);
      setRendererState('fallback');
      return undefined;
    }

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    gl.useProgram(program);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      resolution: gl.getUniformLocation(program, 'uResolution'),
      time: gl.getUniformLocation(program, 'uTime'),
      level: gl.getUniformLocation(program, 'uLevel'),
      energy: gl.getUniformLocation(program, 'uEnergy'),
      speaking: gl.getUniformLocation(program, 'uSpeaking'),
      expressive: gl.getUniformLocation(program, 'uExpressive'),
      leftEye: gl.getUniformLocation(program, 'uLeftEye'),
      rightEye: gl.getUniformLocation(program, 'uRightEye'),
      gazeOffset: gl.getUniformLocation(program, 'uGazeOffset'),
      eyeRotation: gl.getUniformLocation(program, 'uEyeRotation'),
      eyeBrightness: gl.getUniformLocation(program, 'uEyeBrightness'),
      eyeWander: gl.getUniformLocation(program, 'uEyeWander'),
      eyeBlink: gl.getUniformLocation(program, 'uEyeBlink'),
      thinking: gl.getUniformLocation(program, 'uThinking'),
      listening: gl.getUniformLocation(program, 'uListening'),
      listeningTime: gl.getUniformLocation(program, 'uListeningTime'),
      orbitPhase: gl.getUniformLocation(program, 'uOrbitPhase'),
      motion: gl.getUniformLocation(program, 'uMotion'),
      primary: gl.getUniformLocation(program, 'uPrimary'),
      secondary: gl.getUniformLocation(program, 'uSecondary'),
      accent: gl.getUniformLocation(program, 'uAccent'),
    };

    const initialVisual = STATE_VISUAL[visualRef.current.state];
    const current = {
      primary: [...initialVisual.primary],
      secondary: [...initialVisual.secondary],
      accent: [...initialVisual.accent],
      energy: initialVisual.energy,
      speaking: visualRef.current.state === 'speaking' ? 1 : 0,
      leftEye: [...initialVisual.leftEye],
      rightEye: [...initialVisual.rightEye],
      eyeRotation: [...initialVisual.eyeRotation],
      eyeBrightness: initialVisual.eyeBrightness,
      eyeWander: initialVisual.eyeWander,
      eyeBlink: initialVisual.eyeBlink,
      thinking: initialVisual.thinking,
      listening: visualRef.current.state === 'listening' ? 1 : 0,
      orbitDrive: visualRef.current.state === 'speaking' ? 1 : 0,
      level: visualRef.current.level,
    };

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduceMotion = reducedMotionQuery.matches;
    let animationFrame = 0;
    let isVisible = true;
    let lastFrameTime = performance.now();
    const startTime = lastFrameTime;
    let lastVisualState = visualRef.current.state;
    let listeningTime = 0;
    let orbitPhase = 0;

    function resizeCanvas() {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
      const width = Math.max(1, Math.round(bounds.width * pixelRatio));
      const height = Math.max(1, Math.round(bounds.height * pixelRatio));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    }

    function draw(now = performance.now()) {
      resizeCanvas();
      const delta = Math.min(0.05, Math.max(0, (now - lastFrameTime) / 1000));
      lastFrameTime = now;
      const target = STATE_VISUAL[visualRef.current.state];
      if (visualRef.current.state !== lastVisualState) {
        if (visualRef.current.state === 'listening') listeningTime = 0;
        lastVisualState = visualRef.current.state;
      }
      if (visualRef.current.state === 'listening') listeningTime += delta;
      const blend = reduceMotion ? 1 : 1 - Math.exp(-delta * 5.5);
      const eyeBlend = reduceMotion
        ? 1
        : 1 - Math.exp(-delta * (visualRef.current.state === 'interrupted' ? 14 : 8.5));

      mixColor(current.primary, target.primary, blend);
      mixColor(current.secondary, target.secondary, blend);
      mixColor(current.accent, target.accent, blend);
      current.energy = mixNumber(current.energy, target.energy, blend);
      current.speaking = mixNumber(
        current.speaking,
        visualRef.current.state === 'speaking' ? 1 : 0,
        reduceMotion ? 1 : 1 - Math.exp(-delta * 7.5)
      );
      mixVector(current.leftEye, target.leftEye, eyeBlend);
      mixVector(current.rightEye, target.rightEye, eyeBlend);
      mixVector(current.eyeRotation, target.eyeRotation, eyeBlend);
      current.eyeBrightness = mixNumber(current.eyeBrightness, target.eyeBrightness, eyeBlend);
      current.eyeWander = mixNumber(current.eyeWander, target.eyeWander, eyeBlend);
      current.eyeBlink = mixNumber(current.eyeBlink, target.eyeBlink, eyeBlend);
      current.thinking = mixNumber(current.thinking, target.thinking, eyeBlend);
      current.listening = mixNumber(
        current.listening,
        visualRef.current.state === 'listening' ? 1 : 0,
        reduceMotion ? 1 : 1 - Math.exp(-delta * 4.2)
      );
      current.orbitDrive = mixNumber(
        current.orbitDrive,
        visualRef.current.state === 'speaking' ? 1 : 0,
        reduceMotion ? 1 : 1 - Math.exp(-delta * 1.65)
      );
      orbitPhase += delta * (0.2 + current.orbitDrive * 0.24);
      current.level = mixNumber(
        current.level,
        visualRef.current.level,
        reduceMotion ? 1 : Math.min(1, blend * 1.8)
      );
      const gaze = gazeRef.current;
      const gazeBlend = reduceMotion ? 1 : 1 - Math.exp(-delta * 13);
      gaze.x = mixNumber(gaze.x, reduceMotion ? 0 : gaze.targetX, gazeBlend);
      gaze.y = mixNumber(gaze.y, reduceMotion ? 0 : gaze.targetY, gazeBlend);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.time, (now - startTime) / 1000);
      gl.uniform1f(uniforms.level, current.level);
      gl.uniform1f(uniforms.energy, current.energy);
      gl.uniform1f(uniforms.speaking, current.speaking);
      gl.uniform1f(uniforms.expressive, visualRef.current.expressiveMotion ? 1 : 0);
      gl.uniform4fv(uniforms.leftEye, current.leftEye);
      gl.uniform4fv(uniforms.rightEye, current.rightEye);
      gl.uniform2f(uniforms.gazeOffset, gaze.x, gaze.y);
      gl.uniform2fv(uniforms.eyeRotation, current.eyeRotation);
      gl.uniform1f(uniforms.eyeBrightness, current.eyeBrightness);
      gl.uniform1f(uniforms.eyeWander, current.eyeWander);
      gl.uniform1f(uniforms.eyeBlink, current.eyeBlink);
      gl.uniform1f(uniforms.thinking, current.thinking);
      gl.uniform1f(uniforms.listening, current.listening);
      gl.uniform1f(uniforms.listeningTime, listeningTime);
      gl.uniform1f(uniforms.orbitPhase, orbitPhase);
      gl.uniform1f(uniforms.motion, reduceMotion ? 0 : 1);
      gl.uniform3fv(uniforms.primary, current.primary);
      gl.uniform3fv(uniforms.secondary, current.secondary);
      gl.uniform3fv(uniforms.accent, current.accent);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    function frame(now) {
      if (isVisible) draw(now);
      animationFrame = window.requestAnimationFrame(frame);
    }

    function startAnimation() {
      window.cancelAnimationFrame(animationFrame);
      if (reduceMotion) {
        draw();
      } else {
        animationFrame = window.requestAnimationFrame(frame);
      }
    }

    const resizeObserver = new ResizeObserver(() => draw());
    resizeObserver.observe(canvas);

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      if (isVisible && reduceMotion) draw();
    });
    intersectionObserver.observe(canvas);

    const handleMotionPreference = (event) => {
      reduceMotion = event.matches;
      startAnimation();
    };
    reducedMotionQuery.addEventListener('change', handleMotionPreference);

    drawRef.current = draw;
    setRendererState('active');
    startAnimation();

    return () => {
      drawRef.current = null;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      reducedMotionQuery.removeEventListener('change', handleMotionPreference);
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
    };
  }, []);

  useEffect(() => {
    drawRef.current?.();
  }, [state, level]);

  useEffect(() => {
    const container = containerRef.current;
    if (!followPointer || !container) return undefined;

    const desktopQuery = window.matchMedia('(min-width: 1025px)');
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const gaze = gazeRef.current;

    const resetGaze = () => {
      gaze.targetX = 0;
      gaze.targetY = 0;
      container.style.setProperty('--ix-orb-gaze-x', '0%');
      container.style.setProperty('--ix-orb-gaze-y', '0%');
      container.style.setProperty('--ix-orb-left-gaze-scale', '1');
      container.style.setProperty('--ix-orb-right-gaze-scale', '1');
    };

    const handlePointerMove = (event) => {
      if (!desktopQuery.matches || reducedMotionQuery.matches || event.pointerType === 'touch') {
        resetGaze();
        return;
      }

      const bounds = container.getBoundingClientRect();
      const deltaX = event.clientX - (bounds.left + bounds.width / 2);
      const deltaY = bounds.top + bounds.height / 2 - event.clientY;
      const distance = Math.hypot(deltaX, deltaY);

      if (distance < 1) {
        resetGaze();
        return;
      }

      // Reach full gaze gradually across the page so the small dashboard orb
      // feels attentive near the card without snapping at distant movement.
      const strength = Math.min(1, distance / Math.max(136, bounds.width * 1.8));
      const directionX = (deltaX / distance) * strength;
      const directionY = (deltaY / distance) * strength;
      gaze.targetX = directionX * 0.09;
      gaze.targetY = directionY * 0.075;

      // The CSS fallback uses the same direction; its transition supplies the
      // smoothing when WebGL is unavailable.
      container.style.setProperty('--ix-orb-gaze-x', `${directionX * 132}%`);
      container.style.setProperty('--ix-orb-gaze-y', `${directionY * -68}%`);
      container.style.setProperty(
        '--ix-orb-left-gaze-scale',
        `${1 + strength * 0.16 - directionX * 0.08}`
      );
      container.style.setProperty(
        '--ix-orb-right-gaze-scale',
        `${1 + strength * 0.16 + directionX * 0.08}`
      );
    };

    const handleDesktopChange = (event) => {
      if (!event.matches) resetGaze();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('pointerleave', resetGaze);
    window.addEventListener('blur', resetGaze);
    desktopQuery.addEventListener('change', handleDesktopChange);
    reducedMotionQuery.addEventListener('change', resetGaze);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerleave', resetGaze);
      window.removeEventListener('blur', resetGaze);
      desktopQuery.removeEventListener('change', handleDesktopChange);
      reducedMotionQuery.removeEventListener('change', resetGaze);
      resetGaze();
      gaze.x = 0;
      gaze.y = 0;
    };
  }, [followPointer]);

  return (
    <div
      ref={containerRef}
      className={`ix-orb-container ${className}`.replace(/\s+/g, ' ').trim()}
      data-state={state}
      data-renderer={rendererState}
      data-expressive={expressiveMotion ? 'true' : 'false'}
      role="img"
      aria-label={ariaLabel || STATE_LABEL[state]}
      style={{ '--ix-orb-fallback-level': level }}
    >
      <canvas ref={canvasRef} className="ix-orb-canvas" aria-hidden="true" />
      <span className="ix-orb-fallback" aria-hidden="true">
        <span className="ix-orb-fallback__orbit">
          <i />
          <i />
          <i />
        </span>
        <span className="ix-orb-fallback__shell">
          <span className="ix-orb-fallback__eye" />
          <span className="ix-orb-fallback__eye" />
        </span>
      </span>
    </div>
  );
}

export const AIOrb = memo(AIOrbBase);

export default AIOrb;
