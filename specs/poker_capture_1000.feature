@training @poker
Feature: Capture 1000 Poker Training Images
  Play many poker hands to capture 1000+ training images with diverse states
  
  Scenario: Capture 150 hands for 1000+ images
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "pw" into "login_password"
    And I tap "login_button"
    Then I should see text "Casino Lobby"
    When I scroll down
    And I scroll down
    Then I should see text "Poker Table"
    When I tap "poker_table_play_button"
    Then I should see text "DEAL"
    # Capture training data for 150 hands (~1000 images)
    When AI captures training data for 150 hands
    Then I should see text "YOU"

