import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X } from 'lucide-react';

interface SearchFiltersProps {
  onSearch: (query: string) => void;
  onFilterChange: (filters: any) => void;
  filterType: 'inventory' | 'suppliers' | 'orders';
}

export default function SearchFilters({ onSearch, onFilterChange, filterType }: SearchFiltersProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<any>({});

  const handleSearch = () => {
    onSearch(searchQuery);
  };

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setFilters({});
    onSearch('');
    onFilterChange({});
  };

  return (
    <Card className="p-6 mb-6 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
            <Input
              placeholder={`Search ${filterType}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700">
            Search
          </Button>
        </div>

        {/* Inventory Filters */}
        {filterType === 'inventory' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select value={filters.category || 'all'} onValueChange={(value) => handleFilterChange('category', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="medications">Medications</SelectItem>
                <SelectItem value="supplies">Supplies</SelectItem>
                <SelectItem value="equipment">Equipment</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="number"
              placeholder="Min Stock"
              value={filters.minStock || ''}
              onChange={(e) => handleFilterChange('minStock', e.target.value)}
            />

            <Input
              type="number"
              placeholder="Max Stock"
              value={filters.maxStock || ''}
              onChange={(e) => handleFilterChange('maxStock', e.target.value)}
            />
          </div>
        )}

        {/* Supplier Filters */}
        {filterType === 'suppliers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select value={filters.status || 'active'} onValueChange={(value) => handleFilterChange('status', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="number"
              placeholder="Min Rating"
              min="0"
              max="5"
              step="0.1"
              value={filters.minRating || ''}
              onChange={(e) => handleFilterChange('minRating', e.target.value)}
            />
          </div>
        )}

        {/* Order Filters */}
        {filterType === 'orders' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select value={filters.status || 'all'} onValueChange={(value) => handleFilterChange('status', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Order Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="partial_delivery">Partial Delivery</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              placeholder="From Date"
              value={filters.dateFrom || ''}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />

            <Input
              type="date"
              placeholder="To Date"
              value={filters.dateTo || ''}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
          </div>
        )}

        {/* Clear Filters Button */}
        {(searchQuery || Object.keys(filters).length > 0) && (
          <Button
            variant="outline"
            onClick={handleClearFilters}
            className="w-full flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            Clear All Filters
          </Button>
        )}
      </div>
    </Card>
  );
}
