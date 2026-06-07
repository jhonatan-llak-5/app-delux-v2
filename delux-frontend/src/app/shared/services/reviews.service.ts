import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@env/environment';

export interface Review {
  id: number;
  product: number;
  product_name: string;
  customer: number;
  customer_name: string;
  customer_initials: string;
  rating: number;
  title: string;
  comment: string;
  verified_purchase: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  helpful_count: number;
  created_at: string;
}

export interface ProductReviewsResp {
  average: number;
  total: number;
  distribution: Record<string, number>;
  results: Review[];
}

@Injectable({ providedIn: 'root' })
export class ReviewsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}`;

  forProduct(productId: number) {
    return this.http.get<ProductReviewsResp>(`${this.base}/products/${productId}/reviews/`);
  }
  postReview(productId: number, rating: number, title: string, comment: string) {
    return this.http.post<Review>(`${this.base}/me/reviews/`, {
      product: productId, rating, title, comment,
    });
  }
  list(params: { status?: string; rating?: number; search?: string } = {}) {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => { if (v) p = p.set(k, String(v)); });
    return this.http.get<{ count: number; results: Review[] }>(`${this.base}/admin/reviews/`, { params: p });
  }
  approve(id: number) { return this.http.post(`${this.base}/admin/reviews/${id}/approve/`, {}); }
  reject(id: number) { return this.http.post(`${this.base}/admin/reviews/${id}/reject/`, {}); }
  delete(id: number) { return this.http.delete(`${this.base}/admin/reviews/${id}/`); }
}
