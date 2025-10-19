"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { showSuccess, showError } from '@/utils/toast';

interface CartItem {
  id: string; // Product ID
  name: string;
  price: number;
  quantity: number;
  photo_url: string | null; // Mantido como string | null para a imagem principal do item no carrinho
  shopkeeper_id: string; // Adicionado para identificar o lojista
  // shipping_cost: number; // Removido
}

interface CartContextType {
  cartItems: CartItem[];
  addItem: (product: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  // totalShippingCost: number; // Removido
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const MIN_ORDER_QUANTITY = 6; // Definindo o pedido mínimo

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    // Initialize cart from localStorage
    if (typeof window !== 'undefined') {
      const savedCart = localStorage.getItem('shoppingCart');
      return savedCart ? JSON.parse(savedCart) : [];
    }
    return [];
  });

  useEffect(() => {
    // Save cart to localStorage whenever it changes
    if (typeof window !== 'undefined') {
      localStorage.setItem('shoppingCart', JSON.stringify(cartItems));
    }
  }, [cartItems]);

  const addItem = useCallback((product: Omit<CartItem, 'quantity'>, quantityToAdd: number = 1) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === product.id);
      
      let newQuantity = quantityToAdd;
      if (newQuantity < MIN_ORDER_QUANTITY) {
        newQuantity = MIN_ORDER_QUANTITY;
      }

      if (existingItem) {
        const updatedQuantity = existingItem.quantity + newQuantity;
        if (updatedQuantity < MIN_ORDER_QUANTITY) {
          showError(`A quantidade total para ${product.name} deve ser de pelo menos ${MIN_ORDER_QUANTITY} unidades.`);
          return prevItems; // Não atualiza se a soma ainda for menor que o mínimo
        }
        showSuccess(`${product.name} quantity updated in cart!`);
        return prevItems.map(item =>
          item.id === product.id
            ? {
                ...item,
                quantity: updatedQuantity,
                name: product.name, // Atualiza o nome
                price: product.price, // Atualiza o preço
                photo_url: product.photo_url, // Atualiza a URL da foto
                shopkeeper_id: product.shopkeeper_id, // Atualiza o shopkeeper_id
                // shipping_cost: product.shipping_cost, // Removido
              }
            : item
        );
      } else {
        showSuccess(`${product.name} added to cart!`);
        return [...prevItems, { ...product, quantity: newQuantity }];
      }
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setCartItems(prevItems => {
      const removedItem = prevItems.find(item => item.id === productId);
      if (removedItem) {
        showSuccess(`${removedItem.name} removed from cart.`);
      }
      return prevItems.filter(item => item.id !== productId);
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity < MIN_ORDER_QUANTITY) {
      showError(`A quantidade para este item deve ser de pelo menos ${MIN_ORDER_QUANTITY} unidades.`);
      return;
    }
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
    showSuccess('Cart cleared!');
  }, []);

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  // const totalShippingCost = cartItems.reduce((sum, item) => sum + (item.shipping_cost * item.quantity), 0); // Removido
  // const totalPrice = totalProductsPrice + totalShippingCost; // Preço total incluindo frete

  const value = {
    cartItems,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    totalItems,
    totalPrice,
    // totalShippingCost, // Removido
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};