Feature: Recipes
  A recipe has a title, a season, ingredients and its instructions.

  Scenario: A recipe is written with existing and new ingredients
    Given the ingredient "Pumpkin" exists
    And I am writing a new recipe
    When I give it the title "Pumpkin soup"
    And I choose the "Winter" season
    And I add the existing ingredient "Pumpkin"
    And I add the new ingredient "Ginger"
    And I save the recipe
    Then the recipe "Pumpkin soup" is saved for winter with "Ginger, Pumpkin"
    And "Ginger" is now in the ingredient list

  Scenario: A recipe needs a title
    Given I am writing a new recipe
    When I save the recipe
    Then I am asked to give the recipe a title

  Scenario: Two recipes cannot have the same title, ignoring case and accents
    Given the recipe "Crêpes" exists
    And I am writing a new recipe
    When I give it the title "crepes"
    And I save the recipe
    Then I am told "You already have a recipe named “Crêpes”."
    And there is still only "Crêpes"

  Scenario: A recipe cannot have the title of a drink
    Given the drink "Mojito" exists
    And I am writing a new recipe
    When I give it the title "Mojito"
    And I save the recipe
    Then I am told "You already have a drink named “Mojito”."

  Scenario: A recipe keeps its title when edited
    Given the recipe "Crêpes" exists
    And I am editing it
    When I give it the title "CRÊPES"
    And I save the recipe
    Then the recipe is saved as "Crêpes"

  Scenario: A recipe written in Markdown is previewed formatted
    Given I am writing a new recipe
    When I write "**Roast** the pumpkin" as the recipe
    And I switch to "Preview"
    Then I see "Roast the pumpkin" with "Roast" in bold
    When I switch to "Write"
    Then the recipe text is still "**Roast** the pumpkin"
