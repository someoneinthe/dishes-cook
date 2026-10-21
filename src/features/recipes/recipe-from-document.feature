Feature: A recipe from a document
  Choose a file (when adding a recipe or a drink) also takes documents: a PDF, a Word document
  (.docx), an OpenDocument text (.odt) or a text file (.txt). Everything is read on the phone,
  nothing is sent nor kept: a PDF's pages are drawn as images (Android's own PDF renderer) and
  read by the same text recognition as photos, one page after the other, up to 5 pages; the other
  documents are read directly, their title found by its style or size (a text file's first line).
  The title, the ingredients and the steps then fill in the form, as from a photo.

  Scenario: A PDF fills in a new recipe, page after page
    When I fill in a new recipe from a PDF whose first page has "Tarte aux pommes" and "3 pommes" and its second page "Cuire 30 min."
    Then the new recipe opens filled in with "Tarte aux pommes", "Pommes: 3" and "Cuire 30 min."
    And the PDF's page images are deleted

  Scenario: Only the first 5 pages of a long PDF are read
    When I fill in a new recipe from a PDF of 8 pages
    Then only its first 5 pages are read
    And I am told that only its first 5 pages were read

  Scenario Outline: A document fills in a new recipe
    When I fill in a new recipe from <document> "Soupe de poireaux" listing "2 poireaux" then "Mixer."
    Then the new recipe opens filled in with "Soupe de poireaux", "Poireaux: 2" and "Mixer."

    Examples:
      | document               |
      | a Word document        |
      | an OpenDocument text   |
      | a text file            |

  Scenario: An old Word document can't be read
    When I choose the file "Recette.doc" for a new recipe
    Then I am told to save it as .docx first
    And no recipe form opens

  Scenario: A PDF that can't be opened
    When I choose a PDF protected by a password for a new recipe
    Then I am told that the file couldn't be read
    And the copies of the file are deleted
