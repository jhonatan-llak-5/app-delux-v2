import { ChangeDetectionStrategy, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import Chart, { ChartConfiguration } from 'chart.js/auto';

@Component({
  selector: 'dlx-chart-canvas',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="relative w-full" [style.height.px]="height">
              <canvas #cv></canvas>
            </div>`,
})
export class ChartCanvasComponent implements OnChanges, OnDestroy, AfterViewInit {
  @ViewChild('cv', { static: true }) cv!: ElementRef<HTMLCanvasElement>;
  @Input({ required: true }) config!: ChartConfiguration;
  @Input() height = 280;

  private chart?: Chart;

  ngAfterViewInit() { this.render(); }

  ngOnChanges(changes: SimpleChanges) {
    if (this.chart && changes['config'] && !changes['config'].firstChange) {
      this.chart.destroy();
      this.render();
    }
  }

  private render() {
    if (!this.cv || !this.config) return;
    this.chart = new Chart(this.cv.nativeElement, this.withHoverDefaults(this.config));
  }

  /** Index-mode hover defaults so values are readable without hitting the line exactly. */
  private withHoverDefaults(cfg: ChartConfiguration): ChartConfiguration {
    const opts: any = { ...(cfg.options || {}) };
    if (!opts.interaction) opts.interaction = { mode: 'index', intersect: false, axis: 'x' };
    if (!opts.hover) opts.hover = { mode: 'index', intersect: false };

    let data = cfg.data;
    if (cfg.type === 'line' && data?.datasets) {
      data = {
        ...data,
        datasets: data.datasets.map((ds: any) => ({
          pointHoverRadius: ds.pointHoverRadius ?? 6,
          pointHitRadius: ds.pointHitRadius ?? 20,
          pointHoverBackgroundColor: ds.pointHoverBackgroundColor ?? ds.borderColor,
          pointHoverBorderColor: ds.pointHoverBorderColor ?? '#fff',
          pointHoverBorderWidth: ds.pointHoverBorderWidth ?? 2,
          ...ds,
        })),
      };
    }
    return { ...cfg, data, options: opts };
  }

  ngOnDestroy() { this.chart?.destroy(); }
}
