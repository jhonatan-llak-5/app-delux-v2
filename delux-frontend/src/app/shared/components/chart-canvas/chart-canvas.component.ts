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
    this.chart = new Chart(this.cv.nativeElement, this.config);
  }

  ngOnDestroy() { this.chart?.destroy(); }
}
