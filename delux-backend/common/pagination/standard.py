from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

    def paginate_queryset(self, queryset, request, view=None):
        """Igual que DRF pero *acota* el numero de pagina al rango valido en vez
        de lanzar 404. Asi, si el cliente queda en una pagina que dejo de existir
        (p. ej. tras borrar filas), recibe la ultima pagina valida sin error."""
        page_size = self.get_page_size(request)
        if not page_size:
            return None

        paginator = self.django_paginator_class(queryset, page_size)
        num_pages = paginator.num_pages or 1

        raw = request.query_params.get(self.page_query_param, 1)
        try:
            number = int(raw)
        except (TypeError, ValueError):
            number = 1
        number = max(1, min(number, num_pages))

        self.page = paginator.page(number)
        self.request = request
        if paginator.num_pages > 1 and self.template is not None:
            self.display_page_controls = True
        return list(self.page)

    def get_paginated_response(self, data):
        return Response({
            'count': self.page.paginator.count,
            'pages': self.page.paginator.num_pages,
            'page':  self.page.number,
            'next':  self.get_next_link(),
            'prev':  self.get_previous_link(),
            'results': data,
        })
