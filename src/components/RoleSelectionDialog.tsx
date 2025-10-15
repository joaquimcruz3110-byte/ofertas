"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, Store } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface RoleSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const RoleSelectionDialog = ({ isOpen, onClose }: RoleSelectionDialogProps) => {
  const navigate = useNavigate();

  const handleRoleSelect = (role: 'comprador' | 'lojista') => {
    localStorage.setItem('pendingRole', role);
    onClose();
    navigate('/login');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Escolha seu Papel</DialogTitle>
          <DialogDescription>
            Como você gostaria de se cadastrar na plataforma?
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Button
            variant="outline"
            className="w-full h-auto py-4 text-lg flex flex-col items-center justify-center space-y-2 border-dyad-dark-blue text-dyad-dark-blue hover:bg-dyad-light-gray"
            onClick={() => handleRoleSelect('comprador')}
          >
            <User className="h-8 w-8 mb-2" />
            <span>Cadastrar como Comprador</span>
            <p className="text-sm text-gray-500 text-center">Explore e compre produtos.</p>
          </Button>
          <Button
            variant="outline"
            className="w-full h-auto py-4 text-lg flex flex-col items-center justify-center space-y-2 border-dyad-dark-blue text-dyad-dark-blue hover:bg-dyad-light-gray"
            onClick={() => handleRoleSelect('lojista')}
          >
            <Store className="h-8 w-8 mb-2" />
            <span>Cadastrar como Lojista</span>
            <p className="text-sm text-gray-500 text-center">Venda seus próprios produtos.</p>
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RoleSelectionDialog;