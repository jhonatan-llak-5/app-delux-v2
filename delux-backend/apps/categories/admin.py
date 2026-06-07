from django.contrib import admin
from .models import Category


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'parent', 'tenant', 'sort_order', 'is_active')
    list_filter = ('is_active', 'tenant')
    search_fields = ('name', 'slug')
    ordering = ('sort_order', 'name')
