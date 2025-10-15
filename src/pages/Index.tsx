import { MadeWithDyad } from "@/components/made-with-dyad";
import { Link } from "react-router-dom"; // Importar Link

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">Welcome to Your Blank App</h1>
        <p className="text-xl text-gray-600">
          Start building your amazing project here!
        </p>
      </div>
      <div className="mb-8">
        <Link to="/admin/sales" className="text-blue-600 hover:underline text-lg">
          Ir para o Painel de Vendas (Admin)
        </Link>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Index;