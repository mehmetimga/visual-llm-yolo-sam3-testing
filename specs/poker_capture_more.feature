@training @poker
Feature: Capture More Poker Training Images
  Continue capturing to reach 1000+ images
  
  Scenario: Capture 300 more hands for additional images
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
    # Capture more training data
    When AI captures training data for 300 hands
    Then I should see text "YOU"

