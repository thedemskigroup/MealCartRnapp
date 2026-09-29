// Combined search and filter meals

import {
  addDocument,
  compoundQueryDocuments,
  deleteDocument,
  deleteSubcollectionDocument,
  getAllDocumentsWithPagination,
  getDocumentById,
  getSubcollectionDocuments,
  queryDocuments,
  setDocumentById,
  setSubcollectionDocument,
  updateDocument,
  uploadImageToFirebase,
} from "@/services/firestore";
import { normalizeSearchText } from "@/utils/searchTokens";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { Timestamp } from "firebase/firestore";
import {
  ADD_MEAL,
  DELETE_MEAL,
  FETCH_ALL_MEALS,
  FETCH_GLOBAL_MEALS,
  FETCH_MEALS,
  FETCH_RECENT_MEALS,
  FILTER_N_SEARCH_MEALS,
  MEALS_SLICE,
  SEARCH_GLOBAL_MEALS,
  UPDATE_MEAL,
} from "../actionTypes";
import {
  INGREDIENTS_CATEGORY_COLLECTION,
  INGREDIENTS_KEY,
  IS_GLOBAL_KEY,
  MEAL_IMAGE_FOLDER,
  MEAL_INGREDIENTS_COLLECTION,
  MEALS_COLLECTION,
} from "../appKeys";

export interface MealIngredient {
  categoryName: string;
  unit: string;
  categoryId?: string;
  cagtegoryUnits?: string[];
  count?: string;
  ingredientId: string;
  ingredientName?: string;
}

export interface Meal {
  id: string;
  name: string;
  category?: string;
  imageUrl?: string;
  prepTime?: string;
  difficulty?: string;
  createdAt?: Date;
  description?: string;
  servings?: string;
  steps?: string[];
  lastViewedAt?: Date;
  ingredients?: MealIngredient[];
  uid: string;
  isGlobal?: boolean;
  // Add other fields as needed
}

export interface MealsState {
  meals: Meal[];
  allMeals: Meal[];
  globalMeals: Meal[];
  recentMeals: Meal[];
  loading: boolean;
  error: any;
}

const initialState: MealsState = {
  meals: [],
  allMeals: [],
  globalMeals: [],
  recentMeals: [],
  loading: false,
  error: null,
};

const saveMealIngredientsToSubcollection = async (
  mealId: string,
  ingredients: any[],
) => {
  try {
    // First, create the parent document in MEAL_INGREDIENTS_COLLECTION
    await setDocumentById(MEAL_INGREDIENTS_COLLECTION, mealId, {
      mealId: mealId,
      createdAt: new Date(),
    });

    // Then add each ingredient to the subcollection
    for (const ing of ingredients) {
      if (ing.ingredientId) {
        const ingredientData: any = {
          name: ing.name || ing.ingredientName,
          unit: ing.unit,
          count: ing.count || "0",
        };

        if (ing.isKroger) {
          ingredientData.isKroger = true;
          ingredientData.krogerIngredientId = ing.krogerIngredientId || "";
          ingredientData.category = ing.category || "";
          // The product's package size ("16 fl oz"). Kept apart from `unit`,
          // which is the recipe amount's unit; the shopping screen shows both.
          ingredientData.krogerUnit = ing.krogerUnit || "";
        } else {
          ingredientData.categoryId = ing.categoryId || ing.category || "";
        }

        await setSubcollectionDocument(
          MEAL_INGREDIENTS_COLLECTION,
          mealId,
          INGREDIENTS_KEY,
          ing.ingredientId,
          ingredientData,
        );
      }
    }
  } catch (error) {
    throw error;
  }
};

const addMealToDb = async (mealData: any) => {
  try {
    // Extract ingredients for subcollection
    const ingredientsForSubcollection = mealData.ingredients || [];

    // Clean the meal data - store IDs + Kroger-specific fields in main meal document
    const cleanedIngredients = ingredientsForSubcollection.map((ing: any) => {
      const base: any = {
        ingredientId: ing.ingredientId,
      };

      if (ing.isKroger) {
        base.isKroger = true;
        base.krogerIngredientId = ing.krogerIngredientId || "";
      } else {
        base.categoryId = ing.categoryId || ing.category;
      }

      return base;
    });

    const cleanedMealData = {
      ...mealData,
      ingredients: cleanedIngredients,
    };

    // Add the meal document
    const meal = await addDocument(MEALS_COLLECTION, cleanedMealData);

    // Save ingredients to subcollection
    await saveMealIngredientsToSubcollection(
      meal.id,
      ingredientsForSubcollection,
    );

    const enrichedMeals = await enrichMealsWithIngredients([meal]);
    return enrichedMeals[0];
  } catch (error) {
    throw error;
  }
};

const deleteMealFromDb = async (mealId: string) => {
  try {
    // Delete the mealIngredients doc FIRST: its security rule authorizes the
    // write by reading the parent meal (get(meals/{mealId})). If we delete the
    // meal first, that get() returns null and the rule denies the write with
    // "Missing or insufficient permissions".
    await deleteDocument(MEAL_INGREDIENTS_COLLECTION, mealId);
    await deleteDocument(MEALS_COLLECTION, mealId);
  } catch (error) {
    throw error;
  }
};

const addMealImage = async (imageUrl: string) => {
  try {
    const uploadedImageUrl = await uploadImageToFirebase(
      imageUrl,
      MEAL_IMAGE_FOLDER + Date.now().toString(),
    );
    return uploadedImageUrl;
  } catch (error) {
    throw error;
  }
};

export const addMeal = createAsyncThunk(
  ADD_MEAL,
  async (mealData: any, { rejectWithValue }) => {
    try {
      let finalMealData = { ...mealData };
      if (
        finalMealData.imageUrl &&
        typeof finalMealData.imageUrl === "string" &&
        !finalMealData.imageUrl.startsWith("http")
      ) {
        try {
          const uploadedImageUrl = await addMealImage(finalMealData.imageUrl);
          finalMealData.imageUrl = uploadedImageUrl;
        } catch (imgErr) {
          return rejectWithValue("Image upload failed: " + imgErr);
        }
      }
      const meal = await addMealToDb(finalMealData);
      return meal;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  },
);

export const updateMeal = createAsyncThunk(
  UPDATE_MEAL,
  async (
    {
      mealData,
      updateWithIngredients = true,
    }: { mealData: any; updateWithIngredients?: boolean },
    { rejectWithValue },
  ) => {
    try {
      let finalMealData = { ...mealData };
      if (
        finalMealData.imageUrl &&
        typeof finalMealData.imageUrl === "string" &&
        !finalMealData.imageUrl.startsWith("http")
      ) {
        try {
          const uploadedImageUrl = await addMealImage(finalMealData.imageUrl);
          finalMealData.imageUrl = uploadedImageUrl;
        } catch (imgErr) {
          return rejectWithValue("Image upload failed: " + imgErr);
        }
      }
      const meal = await updateMealInDb(finalMealData, updateWithIngredients);
      return meal;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  },
);

export const deleteMeal = createAsyncThunk(
  DELETE_MEAL,
  async (mealId: string, { rejectWithValue }) => {
    try {
      await deleteMealFromDb(mealId);
      return mealId;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  },
);

export const enrichMealsWithIngredients = async (
  meals: any[],
): Promise<any[]> => {
  return Promise.all(
    meals.map(async (meal: any) => {
      try {
        const mealIngredientsDoc = await getDocumentById(
          MEAL_INGREDIENTS_COLLECTION,
          meal.id,
        );

        if (!mealIngredientsDoc) {
          return meal;
        }

        const ingredientsData = await getSubcollectionDocuments(
          MEAL_INGREDIENTS_COLLECTION,
          meal.id,
          "ingredients",
        );

        // Build ingredients from subcollection (source of truth)
        const enrichedIngredients = await Promise.all(
          ingredientsData.map(async (subDoc: any) => {
            // Kroger ingredient
            if (subDoc.isKroger) {
              return {
                ingredientId: subDoc.id,
                isKroger: true,
                krogerIngredientId: subDoc.krogerIngredientId || "",
                count: subDoc.count || "0",
                ingredientName: subDoc.name || "",
                unit: subDoc.unit || "",
                krogerUnit: subDoc.krogerUnit || "",
                categoryName: subDoc.category || "",
              };
            }

            // Non-Kroger: look up category from Firestore
            const categoryId = subDoc.categoryId || "";
            let categoryName = "";
            let categoryUnits: any = [];
            if (categoryId) {
              try {
                const categoryDoc: any = await getDocumentById(
                  INGREDIENTS_CATEGORY_COLLECTION,
                  categoryId,
                );
                categoryName = categoryDoc?.title || "";
                categoryUnits = categoryDoc?.unit || [];
              } catch (error) {}
            }

            return {
              ingredientId: subDoc.id,
              categoryId,
              count: subDoc.count || "0",
              ingredientName: subDoc.name || "",
              unit: subDoc.unit || "",
              categoryName,
              categoryUnits,
            };
          }),
        );

        return {
          ...meal,
          ingredients: enrichedIngredients,
        };
      } catch (error) {
        return meal;
      }
    }),
  );
};

export const fetchUserMeals = createAsyncThunk(
  FETCH_MEALS,
  async (
    {
      userId,
      limit = 10,
      startAfter = null,
    }: { userId: string; limit?: number; startAfter?: any },
    { rejectWithValue },
  ) => {
    ``;
    try {
      const options: any = {
        limit,
        orderBy: "createdAt",
        orderDirection: "desc",
      };
      if (startAfter) options.startAfter = startAfter;

      const meals = await queryDocuments(
        MEALS_COLLECTION,
        "uid",
        "==",
        userId,
        options,
      );

      const enrichedMeals = await enrichMealsWithIngredients(meals);

      return enrichedMeals;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  },
);

export const fetchAllMeals = createAsyncThunk(
  FETCH_ALL_MEALS,
  async (
    { limit = 10, startAfter = null }: { limit?: number; startAfter?: any },
    { rejectWithValue },
  ) => {
    try {
      const options: any = {
        limit,
        orderBy: "createdAt",
        orderDirection: "desc",
      };
      if (startAfter) options.startAfter = startAfter;

      const meals = await getAllDocumentsWithPagination(
        MEALS_COLLECTION,
        options,
      );

      const enrichedMeals = await enrichMealsWithIngredients(meals);

      return enrichedMeals;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  },
);

// Fetch global meals (isGlobal == true), shared across all users.
export const fetchGlobalMeals = createAsyncThunk(
  FETCH_GLOBAL_MEALS,
  async (
    { limit = 10, startAfter = null }: { limit?: number; startAfter?: any },
    { rejectWithValue },
  ) => {
    try {
      const options: any = {
        limit,
        orderBy: "createdAt",
        orderDirection: "desc",
      };
      if (startAfter) options.startAfter = startAfter;

      const meals = await queryDocuments(
        MEALS_COLLECTION,
        IS_GLOBAL_KEY,
        "==",
        true,
        options,
      );

      const enrichedMeals = await enrichMealsWithIngredients(meals);

      return enrichedMeals;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  },
);

// Search/filter global meals (isGlobal == true) — mirrors searchMeals but
// scoped to the shared global set instead of a single user's meals.
export const searchGlobalMeals = createAsyncThunk(
  SEARCH_GLOBAL_MEALS,
  async (
    {
      category = null,
      difficulty = null,
      prepTime = null,
      searchText = "",
      limit = 10,
      startAfter = null,
    }: {
      category?: string | null;
      difficulty?: string | null;
      prepTime?: string | null;
      searchText?: string;
      limit?: number;
      startAfter?: any;
    },
    { rejectWithValue },
  ) => {
    try {
      const filters: any[] = [{ field: IS_GLOBAL_KEY, op: "==", value: true }];
      if (category) {
        filters.push({ field: "category", op: "==", value: category });
      }
      if (difficulty) {
        filters.push({ field: "difficulty", op: "==", value: difficulty });
      }
      // Must use the same normalization the tokens were built with, or e.g.
      // "Egg  Roll" fails to match the stored "egg roll".
      const normalizedSearch = normalizeSearchText(searchText);
      if (normalizedSearch) {
        filters.push({
          field: "nameCharacters",
          op: "array-contains",
          value: normalizedSearch,
        });
      }
      const options: any = {
        limit,
        orderBy: "createdAt",
        orderDirection: "desc",
      };
      if (startAfter) options.startAfter = startAfter;

      let meals = await compoundQueryDocuments(
        MEALS_COLLECTION,
        filters,
        options,
      );

      if (prepTime) {
        meals = meals.filter((meal: any) => {
          const prep = meal.prepTime || "";
          const minutes = parseInt(prep.match(/\d+/)?.[0] || "0");
          if (prepTime === "< 5 Mins") return minutes < 5;
          if (prepTime === "5 - 10 Mins") return minutes >= 5 && minutes <= 10;
          if (prepTime === "10 - 15 Mins")
            return minutes >= 10 && minutes <= 15;
          if (prepTime === "> 15 Mins") return minutes > 15;
          return true;
        });
      }

      const enrichedMeals = await enrichMealsWithIngredients(meals);

      return enrichedMeals;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  },
);

export const fetchRecentMeals = createAsyncThunk(
  FETCH_RECENT_MEALS,
  async (
    {
      userId,
      limit = 4,
      startAfter = null,
    }: { userId: string; limit?: number; startAfter?: any },
    { rejectWithValue },
  ) => {
    try {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      const options: any = {
        limit,
        orderBy: "lastViewedAt",
        orderDirection: "desc",
      };
      if (startAfter) options.startAfter = startAfter;

      const meals = await compoundQueryDocuments(
        MEALS_COLLECTION,
        [
          { field: "uid", op: "==", value: userId },
          {
            field: "lastViewedAt",
            op: ">=",
            value: Timestamp.fromDate(twoDaysAgo),
          },
        ],
        options,
      );

      const enrichedMeals = await enrichMealsWithIngredients(meals);

      return enrichedMeals;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  },
);

export const searchMeals = createAsyncThunk(
  FILTER_N_SEARCH_MEALS,
  async (
    {
      userId,
      category = null,
      difficulty = null,
      prepTime = null,
      searchText = "",
      limit = 10,
      startAfter = null,
    }: {
      userId: string;
      category?: string | null;
      difficulty?: string | null;
      prepTime?: string | null;
      searchText?: string;
      limit?: number;
      startAfter?: any;
    },
    { rejectWithValue },
  ) => {
    try {
      const filters: any[] = [{ field: "uid", op: "==", value: userId }];
      if (category) {
        filters.push({ field: "category", op: "==", value: category });
      }
      if (difficulty) {
        filters.push({ field: "difficulty", op: "==", value: difficulty });
      }
      // Must use the same normalization the tokens were built with, or e.g.
      // "Egg  Roll" fails to match the stored "egg roll".
      const normalizedSearch = normalizeSearchText(searchText);
      if (normalizedSearch) {
        filters.push({
          field: "nameCharacters",
          op: "array-contains",
          value: normalizedSearch,
        });
      }
      const options: any = {
        limit,
        orderBy: "createdAt",
        orderDirection: "desc",
      };
      if (startAfter) options.startAfter = startAfter;

      let meals = await compoundQueryDocuments(
        MEALS_COLLECTION,
        filters,
        options,
      );

      if (prepTime) {
        meals = meals.filter((meal: any) => {
          const prep = meal.prepTime || "";
          const minutes = parseInt(prep.match(/\d+/)?.[0] || "0");
          if (prepTime === "< 5 Mins") return minutes < 5;
          if (prepTime === "5 - 10 Mins") return minutes >= 5 && minutes <= 10;
          if (prepTime === "10 - 15 Mins")
            return minutes >= 10 && minutes <= 15;
          if (prepTime === "> 15 Mins") return minutes > 15;
          return true;
        });
      }

      const enrichedMeals = await enrichMealsWithIngredients(meals);

      return enrichedMeals;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  },
);

// Helper function to update meal ingredients in subcollection
const updateMealIngredientsSubcollection = async (
  mealId: string,
  ingredients: any[],
) => {
  try {
    // Get the mealIngredients document
    const mealIngredientsDoc = await getDocumentById(
      MEAL_INGREDIENTS_COLLECTION,
      mealId,
    );

    if (!mealIngredientsDoc) {
      await setDocumentById(MEAL_INGREDIENTS_COLLECTION, mealId, {
        mealId: mealId,
        createdAt: new Date(),
      });
    }

    const newIngredientIds = new Set(
      ingredients
        .filter((ing) => ing.ingredientId)
        .map((ing) => ing.ingredientId),
    );
    const existingIngredients = await getSubcollectionDocuments(
      MEAL_INGREDIENTS_COLLECTION,
      mealId,
      INGREDIENTS_KEY,
    );
    await Promise.all(
      existingIngredients
        .filter((existing: any) => !newIngredientIds.has(existing.id))
        .map((stale: any) =>
          deleteSubcollectionDocument(
            MEAL_INGREDIENTS_COLLECTION,
            mealId,
            INGREDIENTS_KEY,
            stale.id,
          ),
        ),
    );

    for (const ing of ingredients) {
      if (ing.ingredientId) {
        const ingredientData: any = {
          name: ing.ingredientName || ing.name,
          unit: ing.unit,
          count: ing.count || "0",
        };

        if (ing.isKroger) {
          ingredientData.isKroger = true;
          ingredientData.krogerIngredientId = ing.krogerIngredientId || "";
          ingredientData.category = ing.category || "";
          // The product's package size ("16 fl oz"). Kept apart from `unit`,
          // which is the recipe amount's unit; the shopping screen shows both.
          ingredientData.krogerUnit = ing.krogerUnit || "";
        } else {
          ingredientData.categoryId = ing.categoryId || ing.category || "";
        }

        await setSubcollectionDocument(
          MEAL_INGREDIENTS_COLLECTION,
          mealId,
          INGREDIENTS_KEY,
          ing.ingredientId,
          ingredientData,
        );
      }
    }
  } catch (error) {}
};

const updateMealInDb = async (
  mealData: any,
  updateWithIngredients: boolean = true,
) => {
  try {
    // Store ingredients for subcollection before cleaning
    const ingredientsForSubcollection = mealData.ingredients || [];

    // Clean ingredients for main meal document - store IDs + Kroger-specific fields
    const cleanedIngredients = ingredientsForSubcollection.map((ing: any) => {
      const base: any = {
        ingredientId: ing.ingredientId,
      };

      if (ing.isKroger) {
        base.isKroger = true;
        base.krogerIngredientId = ing.krogerIngredientId || "";
      } else {
        base.categoryId = ing.categoryId;
      }

      return base;
    });

    // Build clean meal data object with only valid Firestore fields
    const cleanedMealData: any = {
      name: mealData.name,
      description: mealData.description,
      imageUrl: mealData.imageUrl,
      prepTime: mealData.prepTime,
      servings: mealData.servings,
      difficulty: mealData.difficulty,
      category: mealData.category,
      ingredients: cleanedIngredients,
      steps: mealData.steps,
      uid: mealData.uid,
      // The search index (see utils/searchTokens.ts). This whitelist is what
      // actually reaches Firestore, so omitting it here means a rename never
      // re-indexes the meal.
      nameCharacters: mealData.nameCharacters,
    };

    // Only add lastViewedAt if it exists
    if (mealData.lastViewedAt) {
      cleanedMealData.lastViewedAt = mealData.lastViewedAt;
    }

    // Check for undefined values
    Object.keys(cleanedMealData).forEach((key) => {
      if (cleanedMealData[key] === undefined) {
        delete cleanedMealData[key];
      }
      if (Array.isArray(cleanedMealData[key])) {
        cleanedMealData[key].forEach((item: any, index: number) => {
          Object.keys(item).forEach((itemKey) => {
            if (item[itemKey] === undefined) {
              delete item[itemKey];
            }
          });
        });
      }
    });

    // Update the main meal document
    const meal = await updateDocument(
      MEALS_COLLECTION,
      mealData.id,
      cleanedMealData,
    );

    // Update ingredient details in subcollection only if updateWithIngredients is true
    if (
      updateWithIngredients &&
      ingredientsForSubcollection &&
      ingredientsForSubcollection.length > 0
    ) {
      await updateMealIngredientsSubcollection(
        mealData.id,
        ingredientsForSubcollection,
      );
    }

    const enrichedMeals = await enrichMealsWithIngredients([meal]);
    return enrichedMeals[0];
  } catch (error) {
    throw error;
  }
};

const mealsSlice = createSlice({
  name: MEALS_SLICE,
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(searchMeals.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchMeals.fulfilled, (state, action) => {
        state.loading = false;
      })
      .addCase(searchMeals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(addMeal.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addMeal.fulfilled, (state, action) => {
        state.loading = false;
        const newMeal = action.payload;
        state.allMeals.push(newMeal);
        // A global meal belongs to the shared list, not the creator's "my meals".
        if (newMeal?.isGlobal) {
          state.globalMeals.unshift(newMeal);
        } else {
          state.meals.push(newMeal);
        }
      })
      .addCase(addMeal.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchUserMeals.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserMeals.fulfilled, (state, action) => {
        state.loading = false;
        const fetchedMeals = action.payload;

        // Only add meals that don't already exist
        const existingIds = new Set(state.meals.map((meal) => meal.id));
        const newMeals = fetchedMeals.filter(
          (meal) => !existingIds.has(meal.id),
        );

        state.meals = [...state.meals, ...newMeals] as Meal[];
      })
      .addCase(fetchUserMeals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchAllMeals.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllMeals.fulfilled, (state, action) => {
        state.loading = false;
        const fetchedMeals = action.payload;

        const existingIds = new Set(state.allMeals.map((meal) => meal.id));
        const newMeals = fetchedMeals.filter(
          (meal) => !existingIds.has(meal.id),
        );

        state.allMeals = [...state.allMeals, ...newMeals] as Meal[];
      })
      .addCase(fetchAllMeals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchGlobalMeals.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchGlobalMeals.fulfilled, (state, action) => {
        state.loading = false;
        const fetchedMeals = action.payload;

        const existingIds = new Set(state.globalMeals.map((meal) => meal.id));
        const newMeals = fetchedMeals.filter(
          (meal) => !existingIds.has(meal.id),
        );

        state.globalMeals = [...state.globalMeals, ...newMeals] as Meal[];
      })
      .addCase(fetchGlobalMeals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(searchGlobalMeals.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchGlobalMeals.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(searchGlobalMeals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateMeal.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateMeal.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        const updatedMeal = action.payload;

        // Update in meals array
        const index = state.meals.findIndex(
          (meal) => meal.id === updatedMeal.id,
        );
        if (index !== -1) {
          state.meals[index] = updatedMeal;
        }

        // Update in allMeals array
        const allMealsIndex = state.allMeals.findIndex(
          (meal) => meal.id === updatedMeal.id,
        );
        if (allMealsIndex !== -1) {
          state.allMeals[allMealsIndex] = updatedMeal;
        }

        // Update in globalMeals array
        const globalMealsIndex = state.globalMeals.findIndex(
          (meal) => meal.id === updatedMeal.id,
        );
        if (globalMealsIndex !== -1) {
          state.globalMeals[globalMealsIndex] = updatedMeal;
        }
      })
      .addCase(updateMeal.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(deleteMeal.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteMeal.fulfilled, (state, action) => {
        state.loading = false;
        const deletedMealId = action.payload;
        state.meals = state.meals.filter((meal) => meal.id !== deletedMealId);
        state.allMeals = state.allMeals.filter(
          (meal) => meal.id !== deletedMealId,
        );
        state.globalMeals = state.globalMeals.filter(
          (meal) => meal.id !== deletedMealId,
        );
        state.recentMeals = state.recentMeals.filter(
          (meal) => meal.id !== deletedMealId,
        );
      })
      .addCase(deleteMeal.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchRecentMeals.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRecentMeals.fulfilled, (state, action) => {
        state.loading = false;
        state.recentMeals = action.payload as Meal[];
      })
      .addCase(fetchRecentMeals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default mealsSlice.reducer;
