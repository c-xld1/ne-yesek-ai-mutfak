
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Recipe = Database['public']['Tables']['recipes']['Row'] & {
  author_name?: string;
  rating?: number;
};

export const useRecipes = () => {
  return useQuery({
    queryKey: ['recipes'],
    queryFn: async () => {
      // First get recipes
      const { data: recipes, error } = await supabase
        .from('recipes')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching recipes:', error);
        throw error;
      }

      // Get all unique author IDs
      const authorIds = [...new Set(recipes?.map(recipe => recipe.author_id).filter(Boolean))];
      
      // Fetch author names if we have author IDs
      let profilesMap = new Map<string, string>();
      if (authorIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', authorIds);

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
        } else if (profiles) {
          profiles.forEach(profile => {
            profilesMap.set(profile.id, profile.full_name || 'Anonim');
          });
        }
      }

      // Then get average ratings for each recipe
      const { data: ratingsData, error: ratingsError } = await supabase
        .from('ratings')
        .select('recipe_id, rating');

      if (ratingsError) {
        console.error('Error fetching ratings:', ratingsError);
      }

      // Calculate average ratings
      const ratingsMap = new Map<string, number>();
      if (ratingsData) {
        const groupedRatings = ratingsData.reduce((acc, rating) => {
          if (!acc[rating.recipe_id]) {
            acc[rating.recipe_id] = [];
          }
          acc[rating.recipe_id].push(rating.rating);
          return acc;
        }, {} as Record<string, number[]>);

        Object.entries(groupedRatings).forEach(([recipeId, ratings]) => {
          const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
          ratingsMap.set(recipeId, Math.round(average * 10) / 10); // Round to 1 decimal
        });
      }

      // Combine the data
      const recipesWithRatings = recipes?.map(recipe => ({
        ...recipe,
        author_name: recipe.author_id ? profilesMap.get(recipe.author_id) || 'Anonim' : 'Anonim',
        rating: ratingsMap.get(recipe.id) || 0
      })) || [];
      
      return recipesWithRatings;
    },
  });
};

export const useRecipeById = (id: string) => {
  return useQuery({
    queryKey: ['recipe', id],
    queryFn: async () => {
      const { data: recipe, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('Error fetching recipe:', error);
        throw error;
      }

      // Get author name if author_id exists
      let authorName = 'Anonim';
      if (recipe.author_id) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', recipe.author_id)
          .single();

        if (!profileError && profile) {
          authorName = profile.full_name || 'Anonim';
        }
      }

      // Get average rating for this recipe
      const { data: ratingsData, error: ratingsError } = await supabase
        .from('ratings')
        .select('rating')
        .eq('recipe_id', id);

      let averageRating = 0;
      if (!ratingsError && ratingsData && ratingsData.length > 0) {
        const sum = ratingsData.reduce((acc, rating) => acc + rating.rating, 0);
        averageRating = Math.round((sum / ratingsData.length) * 10) / 10;
      }

      return {
        ...recipe,
        author_name: authorName,
        rating: averageRating
      };
    },
    enabled: !!id,
  });
};

export const useRecipesByCategory = (category?: string) => {
  return useQuery({
    queryKey: ['recipes', 'category', category],
    queryFn: async () => {
      let query = supabase
        .from('recipes')
        .select('*')
        .order('created_at', { ascending: false });
      
      const { data: recipes, error } = await query;
      
      if (error) {
        console.error('Error fetching recipes by category:', error);
        throw error;
      }

      // Get all unique author IDs
      const authorIds = [...new Set(recipes?.map(recipe => recipe.author_id).filter(Boolean))];
      
      // Fetch author names if we have author IDs
      let profilesMap = new Map<string, string>();
      if (authorIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', authorIds);

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
        } else if (profiles) {
          profiles.forEach(profile => {
            profilesMap.set(profile.id, profile.full_name || 'Anonim');
          });
        }
      }

      // Get ratings for all recipes
      const { data: ratingsData, error: ratingsError } = await supabase
        .from('ratings')
        .select('recipe_id, rating');

      const ratingsMap = new Map<string, number>();
      if (!ratingsError && ratingsData) {
        const groupedRatings = ratingsData.reduce((acc, rating) => {
          if (!acc[rating.recipe_id]) {
            acc[rating.recipe_id] = [];
          }
          acc[rating.recipe_id].push(rating.rating);
          return acc;
        }, {} as Record<string, number[]>);

        Object.entries(groupedRatings).forEach(([recipeId, ratings]) => {
          const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
          ratingsMap.set(recipeId, Math.round(average * 10) / 10);
        });
      }

      return recipes?.map(recipe => ({
        ...recipe,
        author_name: recipe.author_id ? profilesMap.get(recipe.author_id) || 'Anonim' : 'Anonim',
        rating: ratingsMap.get(recipe.id) || 0
      })) || [];
    },
  });
};
