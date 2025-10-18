"use client";

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

const GlobalSearchBar = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/explorar-produtos?search=${encodeURIComponent(searchTerm.trim())}`);
      setSearchTerm('');
    }
  };

  return (
    <div className="w-full bg-dyad-light-gray p-4 shadow-sm">
      <form onSubmit={handleSearch} className="relative flex items-center max-w-4xl mx-auto">
        <Search className="absolute left-3 h-5 w-5 text-gray-500" />
        <Input
          type="text"
          placeholder="Buscar produtos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-grow pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-dyad-vibrant-orange text-dyad-dark-gray"
        />
        <Button type="submit" className="ml-2 bg-dyad-vibrant-orange hover:bg-orange-600 text-dyad-white">
          Buscar
        </Button>
      </form>
    </div>
  );
};

export default GlobalSearchBar;