@vision @poker
Feature: AI Poker Game Testing
  Test the Texas Hold'em poker game with AI-powered element detection
  Uses YOLO-trained model for card and button detection

  @smoke
  Scenario: Login and navigate to poker table
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "pw" into "login_password"
    And I tap "login_button"
    Then I should see text "Casino Lobby"
    When I scroll down
    And I scroll down
    Then I should see text "Poker Table"
    When I tap "poker_table_play_button"
    Then I should see text "FOLD"
    # AI plays 5 hands - tap available action buttons
    # Hand 1
    When I wait 2 seconds
    And I tap "check_button"
    And I wait 4 seconds
    # Hand 2
    When I tap "deal_button"
    And I wait 2 seconds
    And I tap "check_button"
    And I wait 4 seconds
    # Hand 3
    When I tap "deal_button"
    And I wait 2 seconds
    And I tap "fold_button"
    And I wait 4 seconds
    # Hand 4
    When I tap "deal_button"
    And I wait 2 seconds
    And I tap "check_button"
    And I wait 4 seconds
    # Hand 5
    When I tap "deal_button"
    And I wait 2 seconds
    And I tap "call_button"
    And I wait 4 seconds
    Then I should see text "YOU"

