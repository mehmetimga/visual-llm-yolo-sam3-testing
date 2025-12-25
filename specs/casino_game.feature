Feature: Casino Game Interactions

  Tests casino game functionality using vision grounding for canvas elements.
  Demonstrates SAM-3 segmentation for precise element targeting.

  @vision
  Scenario: Play slots with canvas-based spin button
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "password123" into "login_password"
    And I tap "login_button"
    Then I should see text "Casino Lobby"
    When I tap "slots_game"
    Then I should see text "MEGA SLOTS"
    # The spin button is rendered on canvas - requires vision grounding
    When I tap "spin_button" using vision
    # After spin, verify balance display is still visible (DOM element)
    Then "balance_display" should be visible

  @vision @segmentation
  Scenario: Adjust bet in slots using canvas controls
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "password123" into "login_password"
    And I tap "login_button"
    When I tap "slots_game"
    Then I should see text "MEGA SLOTS"
    # Bet controls are canvas-rendered - SAM-3 helps with precise targeting
    When I tap the "bet_plus_button" on the game canvas
    And I tap the "bet_plus_button" on the game canvas
    Then the "balance_display" should display
    When I tap "spin_button" using vision
    Then "balance_display" should be visible

  @vision
  Scenario: Play blackjack game
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "password123" into "login_password"
    And I tap "login_button"
    When I tap "blackjack_game"
    Then I should see text "BLACKJACK"
    # Card game controls on canvas
    When I tap "deal_button" using vision
    Then "hit_button" should be visible
    And "stand_button" should be visible
    When I tap "hit_button" using vision
    Then "balance_display" should be visible

  Scenario: Navigate back from game to lobby
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "password123" into "login_password"
    And I tap "login_button"
    When I tap "slots_game"
    Then I should see text "MEGA SLOTS"
    When I tap "back_button"
    Then I should see text "Casino Lobby"
