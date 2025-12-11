import { useRecipe } from './useRecipe';

export type ActiveRecipe = {
  id: number;
  name: string;
  active: boolean;
};

export function useActiveRecipes() {
  // Check recipes 1-2 to find active ones
  const { recipe: recipe1, isLoading: loading1 } = useRecipe(1);
  const { recipe: recipe2, isLoading: loading2 } = useRecipe(2);

  const activeRecipes: ActiveRecipe[] = [];

  // Add recipe 1 if active
  if (recipe1?.active) {
    activeRecipes.push({ id: 1, name: 'OG Coin', active: true });
  }

  // Add recipe 2 as disabled (coming soon)
  activeRecipes.push({ id: 2, name: 'Necklace - coming soon', active: false });

  return {
    recipes: activeRecipes,
    isLoading: loading1 || loading2,
  };
}
