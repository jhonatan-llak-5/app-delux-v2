import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * SVG estilizado de sneaker — perspectiva ¾ moderna.
 * Se colorea con CSS via currentColor y gradientes.
 */
@Component({
  selector: 'dlx-sneaker-svg',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 360 200" xmlns="http://www.w3.org/2000/svg"
         class="w-full h-full" [attr.aria-label]="label">
      <defs>
        <linearGradient [id]="gradId" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"  [attr.stop-color]="primary"  />
          <stop offset="50%" [attr.stop-color]="secondary" />
          <stop offset="100%" [attr.stop-color]="tertiary"  />
        </linearGradient>
        <linearGradient [id]="soleId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="#ffffff" stop-opacity="0.95" />
          <stop offset="100%" stop-color="#cbd5e1" stop-opacity="0.8" />
        </linearGradient>
        <filter [id]="shadowId" x="-20%" y="-10%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="6" />
          <feOffset dx="0" dy="6" result="off" />
          <feComponentTransfer><feFuncA type="linear" slope="0.6" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <!-- Sombra elíptica suelo -->
      <ellipse cx="180" cy="178" rx="130" ry="10" fill="rgba(0,0,0,0.45)" />

      <g [attr.filter]="'url(#' + shadowId + ')'">
        <!-- Upper / silhouette tipo runner -->
        <path d="M 50 150
                 C 55 130, 70 110, 95 100
                 C 130 88,  170 80, 205 80
                 C 230 80,  255 90, 275 105
                 C 295 118, 310 130, 315 145
                 L 320 158
                 L 312 162
                 Q 295 168, 270 168
                 L 70 168
                 Q 55 168, 50 158 Z"
              [attr.fill]="'url(#' + gradId + ')'" />

        <!-- Detalle medio (banda lateral) -->
        <path d="M 110 130 L 200 122 L 215 152 L 120 158 Z"
              fill="rgba(0,0,0,0.18)" />
        <path d="M 130 118 Q 165 110, 200 108"
              [attr.stroke]="accent" stroke-width="3" fill="none" stroke-linecap="round" />

        <!-- Cordones -->
        <line x1="155" y1="98"  x2="155" y2="115" stroke="#ffffff" stroke-width="2" stroke-linecap="round" />
        <line x1="175" y1="92"  x2="175" y2="110" stroke="#ffffff" stroke-width="2" stroke-linecap="round" />
        <line x1="195" y1="88"  x2="195" y2="106" stroke="#ffffff" stroke-width="2" stroke-linecap="round" />

        <!-- Logo dot -->
        <circle cx="245" cy="125" r="6" [attr.fill]="accent" />

        <!-- Suela (boost-like) -->
        <path d="M 50 158 L 320 158 L 312 178 L 60 178 Z"
              [attr.fill]="'url(#' + soleId + ')'" />
        <!-- Textura suela -->
        <line x1="70"  y1="168" x2="75"  y2="178" stroke="rgba(0,0,0,0.15)" stroke-width="1" />
        <line x1="100" y1="168" x2="105" y2="178" stroke="rgba(0,0,0,0.15)" stroke-width="1" />
        <line x1="130" y1="168" x2="135" y2="178" stroke="rgba(0,0,0,0.15)" stroke-width="1" />
        <line x1="160" y1="168" x2="165" y2="178" stroke="rgba(0,0,0,0.15)" stroke-width="1" />
        <line x1="190" y1="168" x2="195" y2="178" stroke="rgba(0,0,0,0.15)" stroke-width="1" />
        <line x1="220" y1="168" x2="225" y2="178" stroke="rgba(0,0,0,0.15)" stroke-width="1" />
        <line x1="250" y1="168" x2="255" y2="178" stroke="rgba(0,0,0,0.15)" stroke-width="1" />
        <line x1="280" y1="168" x2="285" y2="178" stroke="rgba(0,0,0,0.15)" stroke-width="1" />
        <line x1="300" y1="168" x2="305" y2="178" stroke="rgba(0,0,0,0.15)" stroke-width="1" />
      </g>
    </svg>
  `,
})
export class SneakerSvgComponent {
  @Input() label = 'sneaker';
  @Input() primary   = '#22d3ee';
  @Input() secondary = '#7c3aed';
  @Input() tertiary  = '#e0399a';
  @Input() accent    = '#ffffff';
  /** unique IDs por instancia para evitar colisiones de gradientes */
  @Input() uid = Math.random().toString(36).slice(2, 8);

  get gradId()   { return `g-${this.uid}`; }
  get soleId()   { return `s-${this.uid}`; }
  get shadowId() { return `sh-${this.uid}`; }
}
