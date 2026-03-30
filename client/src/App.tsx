import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Produtos from "./pages/Produtos";
import Historico from "./pages/Historico";
import Previsoes from "./pages/Previsoes";
import Ranking from "./pages/Ranking";
import Indices from "./pages/Indices";
import Alertas from "./pages/Alertas";
import Top10 from "./pages/Top10";
import ComparativoRegional from "./pages/ComparativoRegional";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/produtos" component={Produtos} />
        <Route path="/historico" component={Historico} />
        <Route path="/previsoes" component={Previsoes} />
        <Route path="/ranking" component={Ranking} />
        <Route path="/top10" component={Top10} />
        <Route path="/comparativo" component={ComparativoRegional} />
        <Route path="/indices" component={Indices} />
        <Route path="/alertas" component={Alertas} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
