"use client";

import { PropsWithChildren } from 'react'; // Mantido PropsWithChildren
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

type PropType = PropsWithChildren<{
  onClick: () => void;
  disabled?: boolean;
  className?: string; // Adicionado className à PropType
}>;

export const PrevButton = (props: PropType) => {
  const { children, onClick, disabled } = props;
  return (
    <Button
      className="embla__button embla__button--prev bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-white rounded-full p-2 h-10 w-10"
      onClick={onClick}
      disabled={disabled}
      aria-label="Previous slide"
    >
      <ArrowLeft className="h-5 w-5" />
      {children}
    </Button>
  );
};

export const NextButton = (props: PropType) => {
  const { children, onClick, disabled } = props;
  return (
    <Button
      className="embla__button embla__button--next bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-white rounded-full p-2 h-10 w-10"
      onClick={onClick}
      disabled={disabled}
      aria-label="Next slide"
    >
      <ArrowRight className="h-5 w-5" />
      {children}
    </Button>
  );
};

export const DotButton = (props: PropType) => {
  const { children, onClick, className } = props;
  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );
};